import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';

/**
 * 実況テキストを 1 文字ずつ表示するウィンドウ。
 * タップで「全文表示 → 次へ」と進み、放置していても自動で進む。
 */
export class MessageWindow {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly cursor: Phaser.GameObjects.Text;

  private fullText = '';
  private revealed = 0;
  private typeEvent: Phaser.Time.TimerEvent | null = null;
  private autoEvent: Phaser.Time.TimerEvent | null = null;
  private resolver: (() => void) | null = null;

  /** 1 文字あたりの表示間隔(ms) */
  charDelay = 26;
  /** 全文表示後、自動で次へ進むまでの待ち時間(ms) */
  autoDelay = 1600;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    this.scene = scene;

    const bg = scene.add.rectangle(0, 0, w, h, COLORS.windowBg, 0.96).setOrigin(0, 0);
    bg.setStrokeStyle(2, COLORS.panelEdge);

    this.label = scene.add
      .text(12, 10, '', textStyle(14, COLORS.text, { wordWrap: { width: w - 24 }, lineSpacing: 5 }))
      .setOrigin(0, 0);

    this.cursor = scene.add
      .text(w - 18, h - 20, '▼', textStyle(12, COLORS.accentText))
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(x, y, [bg, this.label, this.cursor]);
    this.container.setDepth(50);

    scene.tweens.add({
      targets: this.cursor,
      alpha: { from: 1, to: 0.15 },
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
  }

  /** テキストを表示し、送られるまで待つ */
  show(text: string): Promise<void> {
    this.clearTimers();
    this.fullText = text;
    this.revealed = 0;
    this.label.setText('');
    this.cursor.setVisible(false);

    return new Promise<void>((resolve) => {
      this.resolver = resolve;
      this.typeEvent = this.scene.time.addEvent({
        delay: this.charDelay,
        repeat: this.fullText.length - 1,
        callback: () => {
          this.revealed += 1;
          this.label.setText(this.fullText.slice(0, this.revealed));
          if (this.revealed >= this.fullText.length) this.onFullyRevealed();
        },
      });
      if (this.fullText.length === 0) this.onFullyRevealed();
    });
  }

  /** タップされたとき: 表示途中なら全文表示、表示済みなら次へ */
  advance(): void {
    if (!this.resolver) return;
    if (this.revealed < this.fullText.length) {
      this.typeEvent?.remove();
      this.typeEvent = null;
      this.revealed = this.fullText.length;
      this.label.setText(this.fullText);
      this.onFullyRevealed();
      return;
    }
    this.resolveNow();
  }

  private onFullyRevealed(): void {
    this.cursor.setVisible(true);
    this.autoEvent?.remove();
    this.autoEvent = this.scene.time.delayedCall(this.autoDelay, () => this.resolveNow());
  }

  private resolveNow(): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.clearTimers();
    this.cursor.setVisible(false);
    resolve?.();
  }

  private clearTimers(): void {
    this.typeEvent?.remove();
    this.typeEvent = null;
    this.autoEvent?.remove();
    this.autoEvent = null;
  }

  setText(text: string): void {
    // 表示待ちのままにすると playEvents 側の await が永久に解決されないので、先に片付ける
    this.resolveNow();
    this.clearTimers();
    this.fullText = text;
    this.revealed = text.length;
    this.label.setText(text);
    this.cursor.setVisible(false);
  }

  destroy(): void {
    this.clearTimers();
    this.container.destroy();
  }
}
