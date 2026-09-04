/**
 * ゲームロジックの型定義。
 * ここには Phaser への依存を一切持ち込まない（純粋なロジックとして単体テストできるようにするため）。
 */

/** どちらのチームか。home = プレイヤー側 */
export type Side = 'home' | 'away';

/** ピッチの横方向。0=左サイド, 1=中央, 2=右サイド */
export type Lane = 0 | 1 | 2;

/**
 * ピッチの縦方向を 5 分割したもの（絶対座標）。
 * 0 = home のゴール前 … 4 = away のゴール前。home は +1 方向へ攻める。
 */
export type Zone = 0 | 1 | 2 | 3 | 4;

export type PositionType = 'GK' | 'DF' | 'MF' | 'FW';

/** 必殺技の種別 */
export type MoveKind = 'shot' | 'dribble' | 'pass' | 'tackle' | 'block';

export interface Stats {
  /** シュート力 */
  shot: number;
  /** パス精度 */
  pass: number;
  /** ドリブル突破力 */
  dribble: number;
  /** タックル（守備）力 */
  tackle: number;
  /** ブロック／セービング力 */
  block: number;
  /** スピード（こぼれ球の反応に影響） */
  speed: number;
  /** ガッツ最大値 */
  maxGuts: number;
}

export interface SpecialMove {
  id: string;
  name: string;
  kind: MoveKind;
  /** 消費ガッツ */
  cost: number;
  /** 判定に加算される補正値 */
  power: number;
  /** 発動時に表示するカットインメッセージ */
  cutIn: string;
}

export interface PlayerDef {
  id: string;
  name: string;
  pos: PositionType;
  /** 自陣を 0 とした配置ゾーン（チームごとの相対値ではなく絶対 Zone で持つ） */
  homeZone: Zone;
  homeLane: Lane;
  stats: Stats;
  moves: SpecialMove[];
}

export interface TeamDef {
  id: string;
  name: string;
  /** スコアボード用の短縮名（4文字程度） */
  short: string;
  /** ユニフォームの主色 */
  color: number;
  /** ユニフォームの差し色 */
  accent: number;
  players: PlayerDef[];
}

/** 試合中に変動する選手の状態 */
export interface PlayerState {
  def: PlayerDef;
  side: Side;
  guts: number;
  zone: Zone;
  lane: Lane;
}

export interface TeamState {
  def: TeamDef;
  side: Side;
  players: PlayerState[];
}

/** プレイヤーが選べる行動 */
export type Action =
  | { type: 'dribble'; moveId: string | null }
  | { type: 'pass'; targetId: string; moveId: string | null }
  | { type: 'shoot'; moveId: string | null }
  | { type: 'hold' };

/** 演出のために UI 側へ渡す試合イベント */
export type MatchEvent =
  | { type: 'message'; text: string }
  | { type: 'cutIn'; text: string; playerId: string }
  | { type: 'duel'; attackerId: string; defenderId: string; attackerWon: boolean }
  | { type: 'move'; carrierId: string; from: Zone; to: Zone; lane: Lane }
  | { type: 'passBall'; fromId: string; toId: string }
  | { type: 'shot'; shooterId: string; keeperId: string; result: ShotResult }
  | { type: 'goal'; side: Side; scorerId: string }
  | { type: 'turnover'; to: Side }
  | { type: 'clock'; minute: number }
  | { type: 'halftime' }
  | { type: 'fulltime' };

export type ShotResult = 'goal' | 'save' | 'blocked' | 'rebound' | 'off';

export type MatchPhase = 'kickoff' | 'play' | 'halftime' | 'fulltime';

export interface Score {
  home: number;
  away: number;
}
