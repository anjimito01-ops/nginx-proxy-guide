import Phaser from 'phaser';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';
import { COLORS, DESIGN_HEIGHT, DESIGN_WIDTH } from './ui/theme';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  // 端末の画面比に合わせて縦持ちで最大化する
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scene: [TitleScene, MatchScene, ResultScene],
};

new Phaser.Game(config);
