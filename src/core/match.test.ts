import { describe, expect, it } from 'vitest';
import { GUREN, SORYO } from '../data/teams';
import { HALF_LENGTH, MatchEngine } from './match';
import { Rng } from './rng';
import { gutsFactor, resolveDuel, shotDistancePenalty } from './rules';
import type { Action, PlayerState } from './types';

function engine(seed = 12345): MatchEngine {
  return new MatchEngine(SORYO, GUREN, { seed });
}

describe('Rng', () => {
  it('同じシードなら同じ乱数列になる', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });
});

describe('gutsFactor', () => {
  const make = (guts: number, maxGuts: number): PlayerState => ({
    def: {
      id: 'x',
      name: 'テスト',
      pos: 'FW',
      homeZone: 3,
      homeLane: 1,
      stats: { shot: 50, pass: 50, dribble: 50, tackle: 50, block: 50, speed: 50, maxGuts },
      moves: [],
    },
    side: 'home',
    guts,
    zone: 3,
    lane: 1,
  });

  it('ガッツが減るほど能力補正が下がる', () => {
    expect(gutsFactor(make(100, 100))).toBe(1);
    expect(gutsFactor(make(40, 100))).toBeLessThan(1);
    expect(gutsFactor(make(10, 100))).toBeLessThan(gutsFactor(make(40, 100)));
    expect(gutsFactor(make(0, 100))).toBeLessThan(gutsFactor(make(10, 100)));
  });
});

describe('shotDistancePenalty', () => {
  it('ゴールから遠いほど威力が落ち、3 ゾーン以上離れると届かない', () => {
    expect(shotDistancePenalty(4, 'home')).toBe(0);
    expect(shotDistancePenalty(3, 'home')).toBeGreaterThan(0);
    expect(shotDistancePenalty(2, 'home')).toBeGreaterThan(shotDistancePenalty(3, 'home'));
    expect(shotDistancePenalty(1, 'home')).toBeGreaterThan(900);
    // away は逆方向へ攻める
    expect(shotDistancePenalty(0, 'away')).toBe(0);
  });
});

describe('resolveDuel', () => {
  it('能力差が大きければ攻撃側がほぼ必ず勝つ', () => {
    const e = engine();
    const ace = e.home.players.find((p) => p.def.id === 'so_fw2')!;
    const weak = e.away.players.find((p) => p.def.id === 'gu_fw3')!;
    const rng = new Rng(7);
    let wins = 0;
    for (let i = 0; i < 200; i += 1) {
      if (resolveDuel(ace, weak, null, rng).attackerWon) wins += 1;
    }
    expect(wins).toBeGreaterThan(180);
  });

  it('必殺ドリブルを使うと突破率が上がる', () => {
    const e = engine();
    const ace = e.home.players.find((p) => p.def.id === 'so_fw2')!;
    const stopper = e.away.players.find((p) => p.def.id === 'gu_df1')!;
    const move = ace.def.moves.find((m) => m.kind === 'dribble')!;

    const count = (withMove: boolean): number => {
      const rng = new Rng(99);
      let wins = 0;
      for (let i = 0; i < 400; i += 1) {
        if (resolveDuel(ace, stopper, withMove ? move : null, rng).attackerWon) wins += 1;
      }
      return wins;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });
});

describe('MatchEngine', () => {
  it('キックオフではセンターの MF がセンターサークルでボールを持つ', () => {
    const e = engine();
    expect(e.possession).toBe('home');
    expect(e.ball).toEqual({ zone: 2, lane: 1 });
    expect(e.carrier.def.pos).toBe('MF');
    expect(e.phase).toBe('play');
  });

  it('自陣深くからはシュートできない', () => {
    const e = engine();
    const gk = e.home.players.find((p) => p.def.pos === 'GK')!;
    e.act({ type: 'pass', targetId: gk.def.id, moveId: null });
    if (e.carrier.def.id === gk.def.id) {
      expect(e.canShoot()).toBe(false);
    }
  });

  it('行動するたびに試合時間が進む', () => {
    const e = engine();
    const before = e.minute;
    e.act({ type: 'hold' });
    expect(e.minute).toBeGreaterThan(before);
  });

  it('前半が終わるとハーフタイムで止まり、後半開始で再開する', () => {
    const e = engine(2024);
    let guard = 0;
    while (e.phase === 'play' && guard < 200) {
      e.act(pickAction(e));
      guard += 1;
    }
    expect(e.phase).toBe('halftime');
    expect(e.minute).toBe(HALF_LENGTH);

    e.startSecondHalf();
    expect(e.phase).toBe('play');
    expect(e.half).toBe(2);
    expect(e.possession).toBe('away');
  });

  it('試合が最後まで破綻せず進み、フルタイムで終わる', () => {
    for (const seed of [1, 2, 3, 77, 4242]) {
      const e = engine(seed);
      let guard = 0;
      while (!e.isOver && guard < 500) {
        if (e.phase === 'halftime') {
          e.startSecondHalf();
        } else {
          e.act(pickAction(e));
        }
        guard += 1;
      }
      expect(e.isOver).toBe(true);
      expect(e.minute).toBe(HALF_LENGTH * 2);
      expect(e.score.home).toBeGreaterThanOrEqual(0);
      expect(e.score.away).toBeGreaterThanOrEqual(0);
      // ガッツが負の値になっていないこと
      for (const p of e.allPlayers()) expect(p.guts).toBeGreaterThanOrEqual(0);
    }
  });
});

/** テスト用の簡易 AI。プレイヤー側もこれで自動操作する */
function pickAction(e: MatchEngine): Action {
  if (e.canShoot()) return { type: 'shoot', moveId: null };
  if (e.canDribble()) return { type: 'dribble', moveId: null };
  const targets = e.passTargets();
  if (targets.length > 0) return { type: 'pass', targetId: targets[0]!.id, moveId: null };
  return { type: 'hold' };
}
