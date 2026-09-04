import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';

export interface MenuItem {
  label: string;
  /** 右端に出す補足（消費ガッツ、危険度など） */
  note?: string;
  enabled?: boolean;
  onSelect: () => void;
}

/**
 * 画面下部のコマンドウィンドウ。
 * 指で押しやすいよう、行の高さは最低 28px を確保する。
 */
export class CommandMenu {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private readonly width: number;
  private readonly height: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    this.scene = scene;
    this.width = w;
    this.height = h;

    const bg = scene.add.rectangle(0, 0, w, h, COLORS.panel, 1).setOrigin(0, 0);
    bg.setStrokeStyle(2, COLORS.panelEdge);
    this.title = scene.add.text(12, 8, '', textStyle(12, COLORS.textDim)).setOrigin(0, 0);

    this.container = scene.add.container(x, y, [bg, this.title]);
    this.container.setDepth(60);
  }

  setItems(title: string, items: MenuItem[]): void {
    this.clearRows();
    this.title.setText(title);

    const top = 28;
    const available = this.height - top - 8;
    const gap = 4;
    // 指で押せる高さ(28px)は確保しつつ、項目が少ないときに間延びしないよう上限も設ける
    const fitted = Math.floor((available - gap * (items.length - 1)) / items.length);
    const rowH = Math.min(44, Math.max(28, fitted));

    items.forEach((item, i) => {
      const enabled = item.enabled !== false;
      const y = top + i * (rowH + gap);

      const box = this.scene.add
        .rectangle(10, y, this.width - 20, rowH, enabled ? 0x1f2140 : 0x16162a, 1)
        .setOrigin(0, 0);
      box.setStrokeStyle(1, enabled ? COLORS.panelEdge : 0x24244a);

      const label = this.scene.add
        .text(22, y + rowH / 2, item.label, textStyle(15, enabled ? COLORS.text : COLORS.textDim))
        .setOrigin(0, 0.5);

      const note = this.scene.add
        .text(
          this.width - 22,
          y + rowH / 2,
          item.note ?? '',
          textStyle(11, enabled ? COLORS.accentText : COLORS.textDim),
        )
        .setOrigin(1, 0.5);

      if (enabled) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerover', () => box.setFillStyle(0x2b2e58, 1));
        box.on('pointerout', () => box.setFillStyle(0x1f2140, 1));
        box.on('pointerdown', () => {
          box.setFillStyle(COLORS.accent, 1);
          label.setColor('#1a1a28');
        });
        box.on('pointerup', () => {
          box.setFillStyle(0x1f2140, 1);
          label.setColor(COLORS.text);
          item.onSelect();
        });
      }

      this.container.add([box, label, note]);
      this.rows.push(box, label, note);
    });
  }

  clearRows(): void {
    for (const row of this.rows) row.destroy();
    this.rows = [];
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.clearRows();
    this.container.destroy();
  }
}
