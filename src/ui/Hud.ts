import Phaser from 'phaser';
import type { MatchEngine } from '../core/match';
import type { PlayerState } from '../core/types';
import { COLORS, textStyle } from './theme';

/** 画面上部のスコアボード */
export class Scoreboard {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly engine: MatchEngine;

  constructor(scene: Phaser.Scene, engine: MatchEngine, x: number, y: number, w: number, h: number) {
    this.engine = engine;

    const bg = scene.add.rectangle(x, y, w, h, COLORS.panel, 1).setOrigin(0, 0);
    bg.setStrokeStyle(2, COLORS.panelEdge);
    bg.setDepth(20);

    scene.add
      .text(x + 10, y + 8, engine.home.def.name, textStyle(12, COLORS.text))
      .setOrigin(0, 0)
      .setDepth(21);
    scene.add
      .text(x + w - 10, y + 8, engine.away.def.name, textStyle(12, COLORS.text))
      .setOrigin(1, 0)
      .setDepth(21);

    this.scoreText = scene.add
      .text(x + w / 2, y + 10, '0 - 0', textStyle(20, COLORS.accentText, { fontStyle: 'bold' }))
      .setOrigin(0.5, 0)
      .setDepth(21);

    this.clockText = scene.add
      .text(x + w / 2, y + h - 4, '前半 0分', textStyle(10, COLORS.textDim))
      .setOrigin(0.5, 1)
      .setDepth(21);

    this.refresh();
  }

  refresh(): void {
    const { score, minute, half, phase } = this.engine.snapshot();
    this.scoreText.setText(`${score.home} - ${score.away}`);
    const label = phase === 'fulltime' ? '試合終了' : half === 1 ? '前半' : '後半';
    this.clockText.setText(phase === 'fulltime' ? label : `${label} ${minute}分`);
  }
}

/** ボール保持者の名前とガッツを表示するバー */
export class CarrierStatus {
  private readonly scene: Phaser.Scene;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly gutsText: Phaser.GameObjects.Text;
  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barWidth: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    this.scene = scene;
    const bg = scene.add.rectangle(x, y, w, h, COLORS.panel, 1).setOrigin(0, 0);
    bg.setStrokeStyle(2, COLORS.panelEdge);
    bg.setDepth(20);

    this.nameText = scene.add
      .text(x + 12, y + 9, '', textStyle(14, COLORS.text))
      .setOrigin(0, 0)
      .setDepth(21);

    this.gutsText = scene.add
      .text(x + w - 12, y + 9, '', textStyle(11, COLORS.textDim))
      .setOrigin(1, 0)
      .setDepth(21);

    this.barWidth = w - 24;
    this.barBg = scene.add
      .rectangle(x + 12, y + h - 16, this.barWidth, 8, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setDepth(21);
    this.barFill = scene.add
      .rectangle(x + 12, y + h - 16, this.barWidth, 8, COLORS.gutsFull, 1)
      .setOrigin(0, 0)
      .setDepth(22);
  }

  update(player: PlayerState, teamName: string): void {
    const ratio = player.def.stats.maxGuts > 0 ? player.guts / player.def.stats.maxGuts : 0;
    this.nameText.setText(`${teamName} ${player.def.pos} ${player.def.name}`);
    this.gutsText.setText(`ガッツ ${Math.round(player.guts)} / ${player.def.stats.maxGuts}`);

    const color = ratio > 0.5 ? COLORS.gutsFull : ratio > 0.2 ? COLORS.gutsMid : COLORS.gutsLow;
    this.barFill.setFillStyle(color, 1);
    this.scene.tweens.add({
      targets: this.barFill,
      displayWidth: Math.max(0, this.barWidth * ratio),
      duration: 220,
      ease: 'Quad.easeOut',
    });
    this.barBg.setVisible(true);
  }
}
