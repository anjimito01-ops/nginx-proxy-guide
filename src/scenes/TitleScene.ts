import Phaser from 'phaser';
import { GUREN, SORYO } from '../data/teams';
import { COLORS, DESIGN_HEIGHT, DESIGN_WIDTH, textStyle } from '../ui/theme';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(DESIGN_WIDTH / 2, 120, '蒼陵イレブン', textStyle(38, COLORS.accentText, { fontStyle: 'bold' }))
      .setOrigin(0.5);
    this.add
      .text(DESIGN_WIDTH / 2, 164, 'コマンド選択式サッカー', textStyle(14, COLORS.textDim))
      .setOrigin(0.5);

    this.add
      .text(
        DESIGN_WIDTH / 2,
        250,
        `${SORYO.name}  vs  ${GUREN.name}`,
        textStyle(16, COLORS.text),
      )
      .setOrigin(0.5);

    const help = [
      '■ あそびかた',
      'ボールを持ったら、コマンドを選んで',
      '相手ゴールへ迫れ。',
      '必殺技はガッツを大きく消費する。',
      '使いどころを見極めろ。',
    ].join('\n');
    this.add
      .text(DESIGN_WIDTH / 2, 330, help, textStyle(13, COLORS.textDim, { align: 'center', lineSpacing: 6 }))
      .setOrigin(0.5, 0);

    const button = this.add
      .rectangle(DESIGN_WIDTH / 2, 500, 220, 52, 0x1f2140, 1)
      .setStrokeStyle(2, COLORS.accent)
      .setInteractive({ useHandCursor: true });
    const buttonLabel = this.add
      .text(DESIGN_WIDTH / 2, 500, 'キックオフ', textStyle(20, COLORS.accentText))
      .setOrigin(0.5);

    button.on('pointerdown', () => {
      button.setFillStyle(COLORS.accent, 1);
      buttonLabel.setColor('#1a1a28');
    });
    button.on('pointerup', () => {
      this.scene.start('Match', { seed: Math.floor(Math.random() * 0xffffffff) });
    });

    this.tweens.add({
      targets: button,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(
        DESIGN_WIDTH / 2,
        DESIGN_HEIGHT - 24,
        '登場する人物・チームはすべて架空のものです',
        textStyle(10, COLORS.textDim),
      )
      .setOrigin(0.5);
  }
}
