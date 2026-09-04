import Phaser from 'phaser';

/** 画面設計の基準解像度（縦持ちスマホ想定） */
export const DESIGN_WIDTH = 360;
export const DESIGN_HEIGHT = 640;

export const COLORS = {
  bg: 0x0a0a12,
  panel: 0x141426,
  panelEdge: 0x3a3a6a,
  windowBg: 0x0d0d1a,
  text: '#f4f4ff',
  textDim: '#9aa0c0',
  accent: 0xffd75e,
  accentText: '#ffd75e',
  pitch: 0x1e6b3a,
  pitchAlt: 0x227540,
  pitchLine: 0xdfe9df,
  ball: 0xfdfdfd,
  gutsFull: 0x5ed46a,
  gutsMid: 0xffd75e,
  gutsLow: 0xe0553f,
  danger: 0xe0553f,
} as const;

/** 日本語が必ず出るフォントスタック（Android WebView では Noto Sans CJK が使われる） */
export const FONT_FAMILY =
  '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", sans-serif';

export function textStyle(
  size: number,
  color: string = COLORS.text,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    ...extra,
  };
}
