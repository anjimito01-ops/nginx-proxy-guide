import Phaser from 'phaser';
import { MatchEngine } from '../core/match';
import type { MatchEvent, PlayerState } from '../core/types';
import { GUREN, SORYO } from '../data/teams';
import { CommandMenu, type MenuItem } from '../ui/CommandMenu';
import { CarrierStatus, Scoreboard } from '../ui/Hud';
import { MessageWindow } from '../ui/MessageWindow';
import { PitchView } from '../ui/PitchView';
import { COLORS, DESIGN_HEIGHT, DESIGN_WIDTH, textStyle } from '../ui/theme';

const LAYOUT = {
  score: { y: 0, h: 56 },
  pitch: { x: 8, y: 60, w: DESIGN_WIDTH - 16, h: 240 },
  status: { y: 304, h: 44 },
  message: { y: 352, h: 64 },
  menu: { y: 420, h: 212 },
} as const;

/** パス先の一覧は指で押しやすい行数に収める */
const MAX_PASS_TARGETS = 4;

export class MatchScene extends Phaser.Scene {
  private engine!: MatchEngine;
  private pitch!: PitchView;
  private board!: Scoreboard;
  private status!: CarrierStatus;
  private msg!: MessageWindow;
  private menu!: CommandMenu;
  private busy = false;
  private shuttingDown = false;

  constructor() {
    super('Match');
  }

  create(data: { seed?: number }): void {
    this.shuttingDown = false;
    this.busy = false;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.engine = new MatchEngine(SORYO, GUREN, { seed: data?.seed });

    this.board = new Scoreboard(this, this.engine, 0, LAYOUT.score.y, DESIGN_WIDTH, LAYOUT.score.h);
    this.pitch = new PitchView(
      this,
      this.engine,
      LAYOUT.pitch.x,
      LAYOUT.pitch.y,
      LAYOUT.pitch.w,
      LAYOUT.pitch.h,
    );
    this.status = new CarrierStatus(this, 0, LAYOUT.status.y, DESIGN_WIDTH, LAYOUT.status.h);
    this.msg = new MessageWindow(this, 0, LAYOUT.message.y, DESIGN_WIDTH, LAYOUT.message.h);
    this.menu = new CommandMenu(this, 0, LAYOUT.menu.y, DESIGN_WIDTH, LAYOUT.menu.h);

    // メッセージ送り用のタップ領域（コマンドウィンドウには重ねない）
    this.add
      .zone(0, 0, DESIGN_WIDTH, LAYOUT.menu.y)
      .setOrigin(0, 0)
      .setDepth(40)
      .setInteractive()
      .on('pointerdown', () => this.msg.advance());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.shuttingDown = true;
    });

    void this.runIntro();
  }

  // -------------------------------------------------------------------------
  // 進行
  // -------------------------------------------------------------------------

  private async runIntro(): Promise<void> {
    this.refreshHud();
    this.menu.setItems('', []);
    await this.msg.show('主審のホイッスルが鳴った。試合開始だ！');
    if (this.shuttingDown) return;
    await this.msg.show(`${SORYO.name}のキックオフ。`);
    this.nextTurn();
  }

  private refreshHud(): void {
    this.board.refresh();
    this.pitch.refresh();
    const carrier = this.engine.carrier;
    this.status.update(carrier, this.engine.team(carrier.side).def.short);
  }

  private nextTurn(): void {
    if (this.shuttingDown) return;
    this.refreshHud();

    switch (this.engine.phase) {
      case 'halftime':
        this.showHalftimeMenu();
        return;
      case 'fulltime':
        this.finish();
        return;
      default:
        break;
    }

    if (this.engine.isPlayerTurn) {
      this.showRootMenu();
    } else {
      void this.runAiTurn();
    }
  }

  private async runAiTurn(): Promise<void> {
    this.busy = true;
    this.menu.setItems(`${this.engine.away.def.name}のボール`, []);
    await this.delay(400);
    if (this.shuttingDown) return;
    const events = this.engine.aiAct();
    await this.playEvents(events);
    this.busy = false;
    this.nextTurn();
  }

  private async submit(action: Parameters<MatchEngine['act']>[0]): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.menu.setItems('プレー中…', []);
    const events = this.engine.act(action);
    await this.playEvents(events);
    this.busy = false;
    this.nextTurn();
  }

  /** エンジンが返したイベント列を順番に演出する */
  private async playEvents(events: MatchEvent[]): Promise<void> {
    for (const ev of events) {
      if (this.shuttingDown) return;
      switch (ev.type) {
        case 'message':
          await this.msg.show(ev.text);
          break;
        case 'cutIn':
          await this.playCutIn(ev.text);
          break;
        case 'duel':
          await this.pitch.shake(ev.attackerWon ? ev.defenderId : ev.attackerId);
          break;
        case 'move':
          await this.pitch.animateMove(ev.carrierId, ev.to, ev.lane);
          break;
        case 'passBall':
          await this.pitch.animatePass(ev.fromId, ev.toId);
          break;
        case 'shot':
          await this.pitch.animateShot(
            ev.shooterId,
            this.engine.findPlayer(ev.shooterId)?.side ?? 'home',
          );
          break;
        case 'goal':
          await this.playGoal(ev.side);
          break;
        case 'turnover':
          this.pitch.refresh();
          break;
        case 'clock':
          this.board.refresh();
          break;
        case 'halftime':
        case 'fulltime':
          break;
      }
      this.status.update(this.engine.carrier, this.engine.team(this.engine.carrier.side).def.short);
    }
  }

  /** 必殺技のカットイン演出 */
  private async playCutIn(text: string): Promise<void> {
    const flash = this.add
      .rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0xffffff, 0.75)
      .setOrigin(0, 0)
      .setDepth(90);
    this.cameras.main.shake(180, 0.006);
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });

    const banner = this.add
      .text(DESIGN_WIDTH / 2, LAYOUT.pitch.y + LAYOUT.pitch.h / 2, text, {
        ...textStyle(17, '#fff6c0', {
          align: 'center',
          wordWrap: { width: DESIGN_WIDTH - 40 },
          fontStyle: 'bold',
        }),
        stroke: '#7a2020',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(95)
      .setScale(0.7);

    this.tweens.add({ targets: banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    await this.delay(900);
    banner.destroy();
  }

  private async playGoal(side: 'home' | 'away'): Promise<void> {
    const color = side === 'home' ? '#ffd75e' : '#ff8f7a';
    const label = this.add
      .text(DESIGN_WIDTH / 2, LAYOUT.pitch.y + LAYOUT.pitch.h / 2, 'GOAL!!', {
        ...textStyle(46, color, { fontStyle: 'bold' }),
        stroke: '#1a1a28',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(95)
      .setScale(0.5);
    this.cameras.main.flash(220, 255, 240, 180);
    this.tweens.add({ targets: label, scale: 1.1, duration: 300, ease: 'Back.easeOut' });
    this.board.refresh();
    await this.delay(1100);
    label.destroy();
    this.pitch.refresh();
  }

  private finish(): void {
    this.menu.setItems('', []);
    this.scene.start('Result', {
      score: this.engine.score,
      homeName: this.engine.home.def.name,
      awayName: this.engine.away.def.name,
    });
  }

  // -------------------------------------------------------------------------
  // コマンドメニュー
  // -------------------------------------------------------------------------

  private showHalftimeMenu(): void {
    this.msg.setText('ハーフタイム。全員が息を整えた。');
    this.menu.setItems('ハーフタイム', [
      {
        label: '後半を開始する',
        onSelect: () => {
          void (async () => {
            this.busy = true;
            this.menu.setItems('', []);
            const events = this.engine.startSecondHalf();
            this.board.refresh();
            this.pitch.refresh();
            await this.playEvents(events);
            this.busy = false;
            this.nextTurn();
          })();
        },
      },
    ]);
  }

  private gutsNote(cost: number): string {
    return `ガッツ -${cost}`;
  }

  /** 前に立ちはだかる相手を見せて、突破かパスかを判断できるようにする */
  private dribbleNote(): string {
    if (!this.engine.canDribble()) return '前がない';
    const foe = this.engine.nextChallenger();
    if (!foe) return 'フリー！';
    return `vs ${foe.def.name}`;
  }

  private showRootMenu(): void {
    const carrier = this.engine.carrier;
    const items: MenuItem[] = [
      {
        label: 'ドリブル',
        note: this.dribbleNote(),
        enabled: this.engine.canDribble(),
        onSelect: () => this.showDribbleMenu(),
      },
      {
        label: 'パス',
        note: '味方へつなぐ',
        onSelect: () => this.showPassMoveMenu(),
      },
      {
        label: 'シュート',
        note: this.engine.canShoot() ? 'ゴールを狙う' : '遠すぎる',
        enabled: this.engine.canShoot(),
        onSelect: () => this.showShootMenu(),
      },
      {
        label: 'キープ',
        note: 'ガッツ +8',
        onSelect: () => void this.submit({ type: 'hold' }),
      },
    ];
    this.menu.setItems(`${carrier.def.name} — コマンド`, items);
  }

  private showDribbleMenu(): void {
    const items: MenuItem[] = this.engine.dribbleOptions().map((opt) => ({
      label: opt.name,
      note: this.gutsNote(opt.cost),
      enabled: opt.enabled,
      onSelect: () => void this.submit({ type: 'dribble', moveId: opt.moveId }),
    }));
    items.push({ label: 'もどる', onSelect: () => this.showRootMenu() });
    this.menu.setItems('ドリブル', items);
  }

  private showShootMenu(): void {
    const items: MenuItem[] = this.engine.shootOptions().map((opt) => ({
      label: opt.name,
      note: this.gutsNote(opt.cost),
      enabled: opt.enabled,
      onSelect: () => void this.submit({ type: 'shoot', moveId: opt.moveId }),
    }));
    items.push({ label: 'もどる', onSelect: () => this.showRootMenu() });
    this.menu.setItems('シュート', items);
  }

  private showPassMoveMenu(): void {
    const options = this.engine.passOptions();
    if (options.length === 1) {
      this.showPassTargetMenu(null);
      return;
    }
    const items: MenuItem[] = options.map((opt) => ({
      label: opt.name,
      note: this.gutsNote(opt.cost),
      enabled: opt.enabled,
      onSelect: () => this.showPassTargetMenu(opt.moveId),
    }));
    items.push({ label: 'もどる', onSelect: () => this.showRootMenu() });
    this.menu.setItems('パス', items);
  }

  private showPassTargetMenu(moveId: string | null): void {
    const targets = this.engine.passTargets().slice(0, MAX_PASS_TARGETS);
    const items: MenuItem[] = targets.map((t) => ({
      label: `${t.pos} ${t.name}`,
      note: `${t.direction}・カット危険度 ${t.risk}`,
      onSelect: () => void this.submit({ type: 'pass', targetId: t.id, moveId }),
    }));
    items.push({ label: 'もどる', onSelect: () => this.showRootMenu() });
    this.menu.setItems('パス先を選ぶ', items);
  }

  // -------------------------------------------------------------------------

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  /** デバッグ用: 現在のボール保持者 */
  get carrier(): PlayerState {
    return this.engine.carrier;
  }
}
