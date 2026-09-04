import Phaser from 'phaser';
import type { Score } from '../core/types';
import { COLORS, DESIGN_WIDTH, textStyle } from '../ui/theme';

interface ResultData {
  score: Score;
  homeName: string;
  awayName: string;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const { score, homeName, awayName } = data;

    const verdict =
      score.home > score.away ? '勝利！' : score.home < score.away ? '敗北……' : '引き分け';
    const verdictColor =
      score.home > score.away ? COLORS.accentText : score.home < score.away ? '#ff8f7a' : '#9aa0c0';

    this.add.text(DESIGN_WIDTH / 2, 120, '試合終了', textStyle(16, COLORS.textDim)).setOrigin(0.5);
    this.add
      .text(DESIGN_WIDTH / 2, 170, verdict, textStyle(36, verdictColor, { fontStyle: 'bold' }))
      .setOrigin(0.5);

    this.add
      .text(
        DESIGN_WIDTH / 2,
        250,
        `${homeName}  ${score.home} - ${score.away}  ${awayName}`,
        textStyle(17, COLORS.text),
      )
      .setOrigin(0.5);

    this.button(360, 'もう一度たたかう', () =>
      this.scene.start('Match', { seed: Math.floor(Math.random() * 0xffffffff) }),
    );
    this.button(430, 'タイトルへ', () => this.scene.start('Title'));
  }

  private button(y: number, label: string, onClick: () => void): void {
    const rect = this.add
      .rectangle(DESIGN_WIDTH / 2, y, 230, 50, 0x1f2140, 1)
      .setStrokeStyle(2, COLORS.accent)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(DESIGN_WIDTH / 2, y, label, textStyle(18, COLORS.accentText)).setOrigin(0.5);

    rect.on('pointerdown', () => {
      rect.setFillStyle(COLORS.accent, 1);
      text.setColor('#1a1a28');
    });
    rect.on('pointerup', onClick);
  }
}
