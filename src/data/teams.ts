import type { Lane, PlayerDef, PositionType, SpecialMove, Stats, TeamDef, Zone } from '../core/types';

/**
 * 登場チーム・選手はすべてオリジナルです。
 * 実在の作品・人物とは関係ありません。
 */

interface StatInput {
  shot: number;
  pass: number;
  dribble: number;
  tackle: number;
  block: number;
  speed: number;
  guts: number;
}

function stats(s: StatInput): Stats {
  return {
    shot: s.shot,
    pass: s.pass,
    dribble: s.dribble,
    tackle: s.tackle,
    block: s.block,
    speed: s.speed,
    maxGuts: s.guts,
  };
}

function player(
  id: string,
  name: string,
  pos: PositionType,
  zone: Zone,
  lane: Lane,
  s: StatInput,
  moves: SpecialMove[] = [],
): PlayerDef {
  return { id, name, pos, homeZone: zone, homeLane: lane, stats: stats(s), moves };
}

// ---------------------------------------------------------------------------
// 蒼陵学園（プレイヤーチーム）
// ---------------------------------------------------------------------------

const SORYO_MOVES = {
  phantomShot: {
    id: 'phantom_shot',
    name: 'ファントムシュート',
    kind: 'shot',
    cost: 26,
    power: 26,
    cutIn: '天羽、体をひねって……ファントムシュート！！',
  },
  gustStep: {
    id: 'gust_step',
    name: '疾風ステップ',
    kind: 'dribble',
    cost: 14,
    power: 20,
    cutIn: '天羽、疾風ステップで抜きにかかる！',
  },
  risingArc: {
    id: 'rising_arc',
    name: 'ライジングアーク',
    kind: 'shot',
    cost: 22,
    power: 20,
    cutIn: '藤堂、ループ気味に……ライジングアーク！',
  },
  threadPass: {
    id: 'thread_pass',
    name: 'スレッドパス',
    kind: 'pass',
    cost: 12,
    power: 24,
    cutIn: '藤堂、針の穴を通すスレッドパス！',
  },
  ironCut: {
    id: 'iron_cut',
    name: 'アイアンカット',
    kind: 'tackle',
    cost: 12,
    power: 20,
    cutIn: '岩瀬、体ごと止めにいく——アイアンカット！',
  },
  gravityHold: {
    id: 'gravity_hold',
    name: 'グラビティホールド',
    kind: 'block',
    cost: 18,
    power: 22,
    cutIn: '神無月、渾身のグラビティホールド！',
  },
} as const satisfies Record<string, SpecialMove>;

export const SORYO: TeamDef = {
  id: 'soryo',
  name: '蒼陵学園',
  short: '蒼陵',
  color: 0x2f6fd0,
  accent: 0xe8f0ff,
  players: [
    player('so_gk', '神無月 護', 'GK', 0, 1, { shot: 20, pass: 45, dribble: 25, tackle: 40, block: 70, speed: 60, guts: 110 }, [
      SORYO_MOVES.gravityHold,
    ]),
    player('so_df1', '岩瀬 鉄平', 'DF', 1, 0, { shot: 35, pass: 50, dribble: 40, tackle: 72, block: 68, speed: 58, guts: 105 }, [
      SORYO_MOVES.ironCut,
    ]),
    player('so_df2', '黒木 隼', 'DF', 1, 1, { shot: 32, pass: 55, dribble: 45, tackle: 66, block: 62, speed: 70, guts: 100 }),
    player('so_df3', '東雲 蓮', 'DF', 1, 1, { shot: 30, pass: 52, dribble: 42, tackle: 64, block: 60, speed: 66, guts: 100 }),
    player('so_df4', '高梨 巧', 'DF', 1, 2, { shot: 38, pass: 58, dribble: 50, tackle: 60, block: 56, speed: 74, guts: 98 }),
    player('so_mf1', '白鳥 玲', 'MF', 2, 0, { shot: 52, pass: 68, dribble: 62, tackle: 55, block: 45, speed: 76, guts: 102 }),
    player('so_mf2', '藤堂 悠真', 'MF', 2, 1, { shot: 66, pass: 82, dribble: 70, tackle: 50, block: 40, speed: 72, guts: 118 }, [
      SORYO_MOVES.threadPass,
      SORYO_MOVES.risingArc,
    ]),
    player('so_mf3', '南 大地', 'MF', 2, 2, { shot: 55, pass: 64, dribble: 58, tackle: 60, block: 48, speed: 70, guts: 104 }),
    player('so_fw1', '御子柴 陸', 'FW', 3, 0, { shot: 64, pass: 56, dribble: 68, tackle: 32, block: 28, speed: 80, guts: 100 }),
    player('so_fw2', '天羽 翔', 'FW', 3, 1, { shot: 80, pass: 60, dribble: 78, tackle: 30, block: 25, speed: 84, guts: 125 }, [
      SORYO_MOVES.phantomShot,
      SORYO_MOVES.gustStep,
    ]),
    player('so_fw3', '桐生 涼太', 'FW', 3, 2, { shot: 62, pass: 58, dribble: 66, tackle: 34, block: 30, speed: 78, guts: 100 }),
  ],
};

// ---------------------------------------------------------------------------
// 紅蓮商業（対戦相手）
// ---------------------------------------------------------------------------

const GUREN_MOVES = {
  burningVolley: {
    id: 'burning_volley',
    name: 'バーニングボレー',
    kind: 'shot',
    cost: 26,
    power: 24,
    cutIn: '炎堂、振り抜いた——バーニングボレー！！',
  },
  blazeRush: {
    id: 'blaze_rush',
    name: 'ブレイズラッシュ',
    kind: 'dribble',
    cost: 14,
    power: 18,
    cutIn: '炎堂、強引に仕掛ける！ブレイズラッシュ！',
  },
  crashTackle: {
    id: 'crash_tackle',
    name: 'クラッシュタックル',
    kind: 'tackle',
    cost: 12,
    power: 22,
    cutIn: '赤峰、容赦なく突っ込む——クラッシュタックル！',
  },
  steelWall: {
    id: 'steel_wall',
    name: 'スチールウォール',
    kind: 'block',
    cost: 18,
    power: 20,
    cutIn: '猛島、立ちはだかる！スチールウォール！',
  },
} as const satisfies Record<string, SpecialMove>;

export const GUREN: TeamDef = {
  id: 'guren',
  name: '紅蓮商業',
  short: '紅蓮',
  color: 0xd0402f,
  accent: 0xffe8e0,
  players: [
    player('gu_gk', '猛島 剛', 'GK', 4, 1, { shot: 22, pass: 42, dribble: 24, tackle: 44, block: 68, speed: 58, guts: 108 }, [
      GUREN_MOVES.steelWall,
    ]),
    player('gu_df1', '赤峰 大河', 'DF', 3, 0, { shot: 34, pass: 48, dribble: 42, tackle: 74, block: 66, speed: 60, guts: 106 }, [
      GUREN_MOVES.crashTackle,
    ]),
    player('gu_df2', '灰谷 誠', 'DF', 3, 1, { shot: 30, pass: 50, dribble: 40, tackle: 65, block: 62, speed: 64, guts: 100 }),
    player('gu_df3', '砂川 淳', 'DF', 3, 1, { shot: 28, pass: 46, dribble: 38, tackle: 62, block: 58, speed: 62, guts: 98 }),
    player('gu_df4', '柏木 亮', 'DF', 3, 2, { shot: 36, pass: 54, dribble: 48, tackle: 58, block: 54, speed: 72, guts: 96 }),
    player('gu_mf1', '真壁 悟', 'MF', 2, 0, { shot: 50, pass: 62, dribble: 58, tackle: 62, block: 46, speed: 70, guts: 102 }),
    player('gu_mf2', '九条 蓮司', 'MF', 2, 1, { shot: 62, pass: 76, dribble: 68, tackle: 54, block: 42, speed: 74, guts: 112 }),
    player('gu_mf3', '土屋 剛志', 'MF', 2, 2, { shot: 48, pass: 60, dribble: 56, tackle: 58, block: 44, speed: 68, guts: 100 }),
    player('gu_fw1', '早乙女 匠', 'FW', 1, 0, { shot: 62, pass: 54, dribble: 64, tackle: 30, block: 26, speed: 78, guts: 98 }),
    player('gu_fw2', '炎堂 烈', 'FW', 1, 1, { shot: 76, pass: 56, dribble: 74, tackle: 32, block: 24, speed: 82, guts: 120 }, [
      GUREN_MOVES.burningVolley,
      GUREN_MOVES.blazeRush,
    ]),
    player('gu_fw3', '雷門 蒼士', 'FW', 1, 2, { shot: 60, pass: 55, dribble: 62, tackle: 33, block: 28, speed: 76, guts: 98 }),
  ],
};

export const TEAMS: Record<string, TeamDef> = {
  [SORYO.id]: SORYO,
  [GUREN.id]: GUREN,
};
