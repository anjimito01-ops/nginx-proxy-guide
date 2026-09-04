import Phaser from 'phaser';

/**
 * 画像アセットを一切持たず、起動時にドット絵テクスチャをコードで生成する。
 * これでリポジトリにバイナリを置かずに済み、APK も軽くなる。
 */

export const TOKEN_W = 16;
export const TOKEN_H = 20;

function withGraphics(scene: Phaser.Scene, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  const g = scene.add.graphics();
  draw(g);
  g.destroy();
}

/** 選手トークン（頭・ユニフォーム・脚のドット絵） */
export function makeTokenTexture(
  scene: Phaser.Scene,
  key: string,
  body: number,
  accent: number,
): void {
  if (scene.textures.exists(key)) return;
  withGraphics(scene, (g) => {
    g.fillStyle(0xf2c9a0, 1);
    g.fillRect(5, 0, 6, 5); // 頭
    g.fillStyle(body, 1);
    g.fillRect(3, 5, 10, 9); // 胴
    g.fillStyle(accent, 1);
    g.fillRect(7, 5, 2, 9); // ライン
    g.fillStyle(0x23233a, 1);
    g.fillRect(4, 14, 3, 5); // 左脚
    g.fillRect(9, 14, 3, 5); // 右脚
    g.generateTexture(key, TOKEN_W, TOKEN_H);
  });
}

/** GK 用トークン（フィールドプレイヤーと色を変える） */
export function makeKeeperTexture(scene: Phaser.Scene, key: string, body: number): void {
  if (scene.textures.exists(key)) return;
  withGraphics(scene, (g) => {
    g.fillStyle(0xf2c9a0, 1);
    g.fillRect(5, 0, 6, 5);
    g.fillStyle(body, 1);
    g.fillRect(2, 5, 12, 9); // 腕を広げた形
    g.fillStyle(0x1a1a28, 1);
    g.fillRect(2, 5, 12, 2);
    g.fillRect(4, 14, 3, 5);
    g.fillRect(9, 14, 3, 5);
    g.generateTexture(key, TOKEN_W, TOKEN_H);
  });
}

export function makeBallTexture(scene: Phaser.Scene, key = 'ball'): void {
  if (scene.textures.exists(key)) return;
  withGraphics(scene, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0x1a1a28, 1);
    g.fillRect(4, 2, 3, 2);
    g.fillRect(2, 6, 2, 2);
    g.fillRect(7, 6, 2, 2);
    g.generateTexture(key, 10, 10);
  });
}

/** ボール保持者を示すリング */
export function makeMarkerTexture(scene: Phaser.Scene, key = 'marker'): void {
  if (scene.textures.exists(key)) return;
  withGraphics(scene, (g) => {
    g.lineStyle(2, 0xffd75e, 1);
    g.strokeEllipse(12, 6, 22, 10);
    g.generateTexture(key, 24, 12);
  });
}
