import Phaser from 'phaser';
import type { MatchEngine } from '../core/match';
import type { Lane, PlayerState, Zone } from '../core/types';
import { COLORS } from './theme';
import { makeBallTexture, makeKeeperTexture, makeMarkerTexture, makeTokenTexture } from './textures';

/**
 * ピッチの俯瞰表示。縦 5 ゾーン × 横 3 レーンのグリッドに選手を配置する。
 * 画面の上が相手ゴール（プレイヤーは上方向へ攻める）。
 */
export class PitchView {
  private readonly scene: Phaser.Scene;
  private readonly engine: MatchEngine;
  private readonly container: Phaser.GameObjects.Container;
  private readonly tokens = new Map<string, Phaser.GameObjects.Image>();
  private readonly marker: Phaser.GameObjects.Image;
  private readonly ball: Phaser.GameObjects.Image;

  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly h: number;

  constructor(scene: Phaser.Scene, engine: MatchEngine, x: number, y: number, w: number, h: number) {
    this.scene = scene;
    this.engine = engine;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    makeTokenTexture(scene, `token-${engine.home.def.id}`, engine.home.def.color, engine.home.def.accent);
    makeTokenTexture(scene, `token-${engine.away.def.id}`, engine.away.def.color, engine.away.def.accent);
    makeKeeperTexture(scene, `keeper-${engine.home.def.id}`, 0x6ad0b8);
    makeKeeperTexture(scene, `keeper-${engine.away.def.id}`, 0xd8a24a);
    makeBallTexture(scene);
    makeMarkerTexture(scene);

    this.container = scene.add.container(x, y);
    this.container.setDepth(10);
    this.drawField();

    this.marker = scene.add.image(0, 0, 'marker').setDepth(11);
    this.ball = scene.add.image(0, 0, 'ball').setDepth(13);

    for (const p of engine.allPlayers()) {
      const key =
        p.def.pos === 'GK' ? `keeper-${this.teamIdOf(p)}` : `token-${this.teamIdOf(p)}`;
      const img = scene.add.image(0, 0, key).setDepth(12);
      this.tokens.set(p.def.id, img);
    }
    this.refresh();
  }

  private teamIdOf(p: PlayerState): string {
    return p.side === 'home' ? this.engine.home.def.id : this.engine.away.def.id;
  }

  private get rowH(): number {
    return this.h / 5;
  }

  private get colW(): number {
    return this.w / 3;
  }

  /** ゾーン中心の画面 Y。zone 4（相手ゴール）が上 */
  cellY(zone: Zone): number {
    return this.y + this.h - (zone + 0.5) * this.rowH;
  }

  cellX(lane: Lane): number {
    return this.x + (lane + 0.5) * this.colW;
  }

  private drawField(): void {
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.pitch, 1);
    g.fillRect(0, 0, this.w, this.h);

    // 縞模様
    g.fillStyle(COLORS.pitchAlt, 1);
    for (let i = 0; i < 5; i += 2) {
      g.fillRect(0, i * this.rowH, this.w, this.rowH);
    }

    g.lineStyle(2, COLORS.pitchLine, 0.85);
    g.strokeRect(1, 1, this.w - 2, this.h - 2);
    // センターライン＆センターサークル
    g.lineBetween(0, this.h / 2, this.w, this.h / 2);
    g.strokeCircle(this.w / 2, this.h / 2, this.rowH * 0.45);
    // ペナルティエリア
    const paW = this.w * 0.5;
    const paH = this.rowH * 0.8;
    g.strokeRect((this.w - paW) / 2, 0, paW, paH);
    g.strokeRect((this.w - paW) / 2, this.h - paH, paW, paH);
    // ゴール
    g.fillStyle(COLORS.pitchLine, 0.9);
    g.fillRect((this.w - paW * 0.45) / 2, 0, paW * 0.45, 4);
    g.fillRect((this.w - paW * 0.45) / 2, this.h - 4, paW * 0.45, 4);

    this.container.add(g);
  }

  /** 全選手をロジック上の位置に合わせて並べ直す */
  refresh(): void {
    const cells = new Map<string, PlayerState[]>();
    for (const p of this.engine.allPlayers()) {
      const key = `${p.zone}:${p.lane}`;
      const list = cells.get(key) ?? [];
      list.push(p);
      cells.set(key, list);
    }

    for (const [, list] of cells) {
      list.forEach((p, i) => {
        const img = this.tokens.get(p.def.id);
        if (!img) return;
        const spread = (i - (list.length - 1) / 2) * 15;
        img.setPosition(this.cellX(p.lane) + spread, this.cellY(p.zone));
        img.setAlpha(p.guts <= 0 ? 0.5 : 1);
      });
    }
    this.syncBall();
  }

  /** ボールとマーカーを保持者に追従させる */
  syncBall(): void {
    const carrier = this.engine.carrier;
    const img = this.tokens.get(carrier.def.id);
    if (!img) return;
    this.marker.setPosition(img.x, img.y + 11);
    this.ball.setPosition(img.x + 10, img.y + 8);
  }

  /** ドリブル／パスでボールが動いたときのアニメーション */
  animateMove(carrierId: string, toZone: Zone, toLane: Lane): Promise<void> {
    const img = this.tokens.get(carrierId);
    if (!img) return Promise.resolve();
    const tx = this.cellX(toLane);
    const ty = this.cellY(toZone);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: img,
        x: tx,
        y: ty,
        duration: 320,
        ease: 'Cubic.easeOut',
        onUpdate: () => this.syncBall(),
        onComplete: () => {
          this.refresh();
          resolve();
        },
      });
    });
  }

  /** パスの軌道。ボールだけを飛ばしてから配置を整える */
  animatePass(fromId: string, toId: string): Promise<void> {
    const from = this.tokens.get(fromId);
    const to = this.tokens.get(toId);
    if (!from || !to) return Promise.resolve();
    this.ball.setPosition(from.x, from.y);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.ball,
        x: to.x + 10,
        y: to.y + 8,
        duration: 300,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.refresh();
          resolve();
        },
      });
    });
  }

  /** 1 対 1 のせめぎ合いを揺れで表現する */
  shake(playerId: string): Promise<void> {
    const img = this.tokens.get(playerId);
    if (!img) return Promise.resolve();
    const baseX = img.x;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: img,
        x: { from: baseX - 4, to: baseX + 4 },
        duration: 60,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          img.setX(baseX);
          this.syncBall();
          resolve();
        },
      });
    });
  }

  /** シュートの軌道 */
  animateShot(shooterId: string, side: 'home' | 'away'): Promise<void> {
    const img = this.tokens.get(shooterId);
    if (!img) return Promise.resolve();
    const goalY = side === 'home' ? this.y + 4 : this.y + this.h - 4;
    this.ball.setPosition(img.x, img.y);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.ball,
        x: this.x + this.w / 2,
        y: goalY,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => resolve(),
      });
    });
  }

  destroy(): void {
    for (const img of this.tokens.values()) img.destroy();
    this.tokens.clear();
    this.marker.destroy();
    this.ball.destroy();
    this.container.destroy();
  }
}
