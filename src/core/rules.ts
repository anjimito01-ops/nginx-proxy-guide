import type { PlayerState, ShotResult, SpecialMove, Zone } from './types';
import type { Rng } from './rng';

/**
 * ガッツ残量による能力補正。
 * 原作同様「終盤にガッツが切れた選手は使いものにならなくなる」感触を出すため、
 * 残量が減るほど段階的に能力が落ちる。
 */
export function gutsFactor(p: PlayerState): number {
  const ratio = p.def.stats.maxGuts > 0 ? p.guts / p.def.stats.maxGuts : 0;
  if (ratio <= 0) return 0.45;
  if (ratio < 0.2) return 0.7;
  if (ratio < 0.5) return 0.88;
  return 1;
}

/** その必殺技を今の残りガッツで撃てるか */
export function canUseMove(p: PlayerState, move: SpecialMove): boolean {
  return p.guts >= move.cost;
}

export function spendGuts(p: PlayerState, amount: number): void {
  p.guts = Math.max(0, p.guts - amount);
}

export function recoverGuts(p: PlayerState, amount: number): void {
  p.guts = Math.min(p.def.stats.maxGuts, p.guts + amount);
}

export interface DuelOutcome {
  attackerWon: boolean;
  attackRoll: number;
  defenseRoll: number;
  /** 圧勝（相手を大きく上回った）かどうか。演出の出し分けに使う */
  decisive: boolean;
}

/**
 * ドリブル突破 vs タックルの 1 対 1 判定。
 * 攻撃側は必殺ドリブルで補正値を上乗せできるが、その分ガッツを大きく消費する。
 */
export function resolveDuel(
  attacker: PlayerState,
  defender: PlayerState,
  move: SpecialMove | null,
  rng: Rng,
  defenderMove: SpecialMove | null = null,
): DuelOutcome {
  const attackRoll =
    attacker.def.stats.dribble * gutsFactor(attacker) + (move?.power ?? 0) + rng.int(0, 24);

  // 自陣ゴールに近い DF ほど粘り強く守る
  const homeGroundBonus = defender.def.pos === 'DF' ? 6 : 0;
  // GK との 1 対 1 は飛び出しての阻止なのでセービング能力で受ける
  const defenseBase =
    defender.def.pos === 'GK'
      ? Math.max(defender.def.stats.tackle, defender.def.stats.block * 0.9)
      : defender.def.stats.tackle;
  const defenseRoll =
    defenseBase * gutsFactor(defender) +
    homeGroundBonus +
    (defenderMove?.power ?? 0) +
    rng.int(0, 24);

  const diff = attackRoll - defenseRoll;
  return {
    attackerWon: diff >= 0,
    attackRoll,
    defenseRoll,
    decisive: Math.abs(diff) >= 25,
  };
}

/** シュート地点による威力減衰。ゴール前ほど有利 */
export function shotDistancePenalty(zone: Zone, side: 'home' | 'away'): number {
  const distance = side === 'home' ? 4 - zone : zone;
  switch (distance) {
    case 0:
      return 0;
    case 1:
      return 8;
    case 2:
      return 26;
    default:
      return 999; // 実質シュート不可
  }
}

export interface ShotOutcome {
  result: ShotResult;
  shotPower: number;
  keeperPower: number;
  blockerId: string | null;
}

/**
 * シュート判定。DF のブロック → GK のセービングの順に処理する。
 * GK をわずかに上回った場合は「こぼれ球」になり、混戦から詰められる余地を残す。
 */
export function resolveShot(
  shooter: PlayerState,
  keeper: PlayerState,
  blockers: PlayerState[],
  move: SpecialMove | null,
  rng: Rng,
  opts: { keeperMove?: SpecialMove | null; keeperCommitted?: boolean } = {},
): ShotOutcome {
  const penalty = shotDistancePenalty(shooter.zone, shooter.side);
  const shotPower = Math.max(
    0,
    shooter.def.stats.shot * gutsFactor(shooter) + (move?.power ?? 0) + rng.int(0, 20) - penalty,
  );

  // 目の前に立ちはだかる DF のブロック判定（最も守備力の高い 1 人）
  const wall = blockers
    .slice()
    .sort((a, b) => b.def.stats.block * gutsFactor(b) - a.def.stats.block * gutsFactor(a))[0];
  if (wall) {
    const blockRoll = wall.def.stats.block * gutsFactor(wall) * 0.9 + rng.int(0, 25);
    if (blockRoll > shotPower * 0.9) {
      return { result: 'blocked', shotPower, keeperPower: 0, blockerId: wall.def.id };
    }
  }

  if (shotPower < 26) {
    return { result: 'off', shotPower, keeperPower: 0, blockerId: null };
  }

  // ドリブルで GK をかわした直後は、GK は体勢を崩しているのでほとんど反応できない
  const committedFactor = opts.keeperCommitted ? 0.35 : 1;
  const keeperPower =
    (keeper.def.stats.block * gutsFactor(keeper) + (opts.keeperMove?.power ?? 0)) * committedFactor +
    rng.int(0, 24);
  if (shotPower > keeperPower) {
    return { result: 'goal', shotPower, keeperPower, blockerId: null };
  }
  // わずかに及ばなかった場合は弾くだけで、こぼれ球の混戦になる
  if (shotPower > keeperPower - 12) {
    return { result: 'rebound', shotPower, keeperPower, blockerId: null };
  }
  return { result: 'save', shotPower, keeperPower, blockerId: null };
}

export interface PassOutcome {
  success: boolean;
  interceptorId: string | null;
}

/**
 * パス判定。パスコース上の相手選手がカットを試みる。
 * 距離が長いほどカットされやすい。
 */
export function resolvePass(
  passer: PlayerState,
  target: PlayerState,
  interceptors: PlayerState[],
  move: SpecialMove | null,
  rng: Rng,
): PassOutcome {
  const distance = Math.abs(target.zone - passer.zone) + Math.abs(target.lane - passer.lane);
  const passPower =
    passer.def.stats.pass * gutsFactor(passer) + (move?.power ?? 0) + rng.int(0, 20) - distance * 7;

  for (const it of interceptors) {
    const cutRoll = it.def.stats.tackle * gutsFactor(it) * 0.55 + rng.int(0, 22);
    if (cutRoll > passPower) {
      return { success: false, interceptorId: it.def.id };
    }
  }
  return { success: true, interceptorId: null };
}
