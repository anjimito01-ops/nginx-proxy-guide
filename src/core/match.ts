import { Rng } from './rng';
import {
  canUseMove,
  recoverGuts,
  resolveDuel,
  resolvePass,
  resolveShot,
  shotDistancePenalty,
  spendGuts,
} from './rules';
import type {
  Action,
  Lane,
  MatchEvent,
  MatchPhase,
  PlayerDef,
  PlayerState,
  PositionType,
  Score,
  Side,
  SpecialMove,
  TeamDef,
  TeamState,
  Zone,
} from './types';

/** 1 コマンドで進む試合時間（分） */
export const MINUTES_PER_TURN = 2;
/** 前後半それぞれの長さ（分） */
export const HALF_LENGTH = 45;

const BASE_COST = { dribble: 3, pass: 2, shoot: 4, hold: 0 } as const;

export interface MoveOption {
  /** null なら通常アクション */
  moveId: string | null;
  name: string;
  cost: number;
  enabled: boolean;
}

export interface PassTargetInfo {
  id: string;
  name: string;
  pos: PositionType;
  /** 攻撃方向に対して前か後ろか */
  direction: '前' | '横' | '後';
  /** カットされる危険度 */
  risk: '低' | '中' | '高';
}

export interface MatchSnapshot {
  score: Score;
  minute: number;
  half: 1 | 2;
  phase: MatchPhase;
  possession: Side;
  carrierId: string;
  ball: { zone: Zone; lane: Lane };
}

function clampZone(z: number): Zone {
  return Math.max(0, Math.min(4, z)) as Zone;
}

/**
 * 試合進行のすべてを司るエンジン。
 * 描画には一切関与せず、状態と「何が起きたか」のイベント列だけを返す。
 */
export class MatchEngine {
  readonly home: TeamState;
  readonly away: TeamState;
  readonly rng: Rng;

  score: Score = { home: 0, away: 0 };
  minute = 0;
  half: 1 | 2 = 1;
  phase: MatchPhase = 'kickoff';
  possession: Side = 'home';
  carrierId = '';
  ball: { zone: Zone; lane: Lane } = { zone: 2, lane: 1 };

  /** ドリブルで GK をかわした直後かどうか（次のシュートが決定的になる） */
  private keeperCommitted = false;

  constructor(homeDef: TeamDef, awayDef: TeamDef, opts: { seed?: number } = {}) {
    this.rng = new Rng(opts.seed ?? Math.floor(Math.random() * 0xffffffff));
    this.home = this.buildTeam(homeDef, 'home');
    this.away = this.buildTeam(awayDef, 'away');
    this.kickoff('home');
  }

  private buildTeam(def: TeamDef, side: Side): TeamState {
    return {
      def,
      side,
      players: def.players.map((p: PlayerDef) => ({
        def: p,
        side,
        guts: p.stats.maxGuts,
        zone: p.homeZone,
        lane: p.homeLane,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // 参照系
  // -------------------------------------------------------------------------

  team(side: Side): TeamState {
    return side === 'home' ? this.home : this.away;
  }

  opponentSide(side: Side): Side {
    return side === 'home' ? 'away' : 'home';
  }

  get carrier(): PlayerState {
    const p = this.findPlayer(this.carrierId);
    if (!p) throw new Error(`ボール保持者が見つかりません: ${this.carrierId}`);
    return p;
  }

  findPlayer(id: string): PlayerState | null {
    return (
      this.home.players.find((p) => p.def.id === id) ??
      this.away.players.find((p) => p.def.id === id) ??
      null
    );
  }

  allPlayers(): PlayerState[] {
    return [...this.home.players, ...this.away.players];
  }

  /** そのチームが攻める方向。home は +1（zone 4 が相手ゴール） */
  attackDir(side: Side): 1 | -1 {
    return side === 'home' ? 1 : -1;
  }

  /** そのチームが攻めるゴールのゾーン */
  targetGoalZone(side: Side): Zone {
    return side === 'home' ? 4 : 0;
  }

  keeperOf(side: Side): PlayerState {
    const gk = this.team(side).players.find((p) => p.def.pos === 'GK');
    if (!gk) throw new Error(`${side} に GK がいません`);
    return gk;
  }

  snapshot(): MatchSnapshot {
    return {
      score: { ...this.score },
      minute: this.minute,
      half: this.half,
      phase: this.phase,
      possession: this.possession,
      carrierId: this.carrierId,
      ball: { ...this.ball },
    };
  }

  get isPlayerTurn(): boolean {
    return this.phase === 'play' && this.possession === 'home';
  }

  get isOver(): boolean {
    return this.phase === 'fulltime';
  }

  // -------------------------------------------------------------------------
  // 配置とキックオフ
  // -------------------------------------------------------------------------

  private resetPositions(): void {
    for (const p of this.allPlayers()) {
      p.zone = p.def.homeZone;
      p.lane = p.def.homeLane;
    }
  }

  private setCarrier(id: string, zone: Zone, lane: Lane): void {
    const prev = this.findPlayer(this.carrierId);
    if (prev && prev.def.id !== id) {
      prev.zone = prev.def.homeZone;
      prev.lane = prev.def.homeLane;
    }
    const next = this.findPlayer(id);
    if (!next) throw new Error(`選手が見つかりません: ${id}`);
    next.zone = zone;
    next.lane = lane;
    this.carrierId = id;
    this.possession = next.side;
    this.ball = { zone, lane };
  }

  kickoff(side: Side): void {
    this.resetPositions();
    this.keeperCommitted = false;
    const mf = this.team(side).players.find((p) => p.def.pos === 'MF' && p.def.homeLane === 1);
    const starter = mf ?? this.team(side).players[5]!;
    this.carrierId = starter.def.id;
    this.possession = side;
    this.setCarrier(starter.def.id, 2, 1);
    this.phase = 'play';
  }

  // -------------------------------------------------------------------------
  // コマンド候補
  // -------------------------------------------------------------------------

  private moveOptions(kind: SpecialMove['kind'], baseName: string, baseCost: number): MoveOption[] {
    const c = this.carrier;
    const options: MoveOption[] = [
      { moveId: null, name: baseName, cost: baseCost, enabled: true },
    ];
    for (const m of c.def.moves) {
      if (m.kind !== kind) continue;
      options.push({
        moveId: m.id,
        name: m.name,
        cost: baseCost + m.cost,
        enabled: canUseMove(c, m) && c.guts >= baseCost + m.cost,
      });
    }
    return options;
  }

  dribbleOptions(): MoveOption[] {
    return this.moveOptions('dribble', 'ドリブル', BASE_COST.dribble);
  }

  shootOptions(): MoveOption[] {
    return this.moveOptions('shot', 'シュート', BASE_COST.shoot);
  }

  passOptions(): MoveOption[] {
    return this.moveOptions('pass', 'パス', BASE_COST.pass);
  }

  /** シュートが届く位置にいるか */
  canShoot(): boolean {
    return shotDistancePenalty(this.carrier.zone, this.carrier.side) < 999;
  }

  /** これ以上前に運べるか */
  canDribble(): boolean {
    const c = this.carrier;
    const next = c.zone + this.attackDir(c.side);
    return next >= 0 && next <= 4;
  }

  /** 次にドリブルで挑むことになる相手。UI の表示と思考ルーチンの両方で使う */
  nextChallenger(): PlayerState | null {
    const c = this.carrier;
    const targetZone = clampZone(c.zone + this.attackDir(c.side));
    return this.challengerFor(c, targetZone);
  }

  passTargets(): PassTargetInfo[] {
    const c = this.carrier;
    const dir = this.attackDir(c.side);
    return this.team(c.side)
      .players.filter((p) => p.def.id !== c.def.id && Math.abs(p.zone - c.zone) <= 2)
      .map((p) => {
        const delta = (p.zone - c.zone) * dir;
        const interceptors = this.interceptorsFor(c, p);
        const risk: PassTargetInfo['risk'] =
          interceptors.length >= 2 ? '高' : interceptors.length === 1 ? '中' : '低';
        return {
          id: p.def.id,
          name: p.def.name,
          pos: p.def.pos,
          direction: delta > 0 ? ('前' as const) : delta < 0 ? ('後' as const) : ('横' as const),
          risk,
        };
      })
      .sort((a, b) => {
        // 前向き・安全なパスほど上に出す
        const dir = (t: PassTargetInfo): number => (t.direction === '前' ? 0 : t.direction === '横' ? 1 : 2);
        const risk = (t: PassTargetInfo): number => (t.risk === '低' ? 0 : t.risk === '中' ? 1 : 2);
        return dir(a) - dir(b) || risk(a) - risk(b);
      });
  }

  // -------------------------------------------------------------------------
  // 判定に関わる相手選手の抽出
  // -------------------------------------------------------------------------

  /** ドリブルで立ちはだかる相手。進行先にいる選手を優先し、いなければ現在地でマークしている選手 */
  private challengerFor(carrier: PlayerState, targetZone: Zone): PlayerState | null {
    const foes = this.team(this.opponentSide(carrier.side)).players;
    const pickFrom = (zone: Zone): PlayerState[] => foes.filter((p) => p.zone === zone);
    let pool = pickFrom(targetZone);
    if (pool.length === 0) pool = pickFrom(carrier.zone);
    if (pool.length === 0) return null;

    const sameLane = pool.filter((p) => p.lane === carrier.lane);
    const candidates = sameLane.length > 0 ? sameLane : pool;
    return candidates.reduce((best, p) => (p.def.stats.tackle > best.def.stats.tackle ? p : best));
  }

  /**
   * パスコース上でカットを狙う相手（最大 2 人）。
   * 「通り道に立っている選手」と「受け手をマークしている選手」を対象にする。
   */
  private interceptorsFor(passer: PlayerState, target: PlayerState): PlayerState[] {
    const lo = Math.min(passer.zone, target.zone);
    const hi = Math.max(passer.zone, target.zone);
    const foes = this.team(this.opponentSide(passer.side)).players.filter(
      (p) => p.def.pos !== 'GK',
    );
    const onTheWay = foes.filter(
      (p) => p.zone > lo && p.zone < hi && Math.abs(p.lane - target.lane) <= 1,
    );
    const marking = foes.filter((p) => p.zone === target.zone && p.lane === target.lane);
    return [...onTheWay, ...marking]
      .sort((a, b) => b.def.stats.tackle - a.def.stats.tackle)
      .slice(0, 2);
  }

  /** シュートコースに入っている相手 DF */
  private blockersFor(shooter: PlayerState): PlayerState[] {
    return this.team(this.opponentSide(shooter.side)).players.filter(
      (p) => p.def.pos !== 'GK' && p.zone === shooter.zone && p.lane === shooter.lane,
    );
  }

  /** 守備側が自動で発動する必殺技（ガッツに余裕があれば 55% で使う） */
  private autoDefenseMove(defender: PlayerState, kind: 'tackle' | 'block'): SpecialMove | null {
    const move = defender.def.moves.find((m) => m.kind === kind);
    if (!move || !canUseMove(defender, move)) return null;
    if (!this.rng.chance(0.55)) return null;
    spendGuts(defender, move.cost);
    return move;
  }

  private resolveMove(carrier: PlayerState, moveId: string | null): SpecialMove | null {
    if (!moveId) return null;
    const move = carrier.def.moves.find((m) => m.id === moveId) ?? null;
    if (move && !canUseMove(carrier, move)) return null;
    return move;
  }

  // -------------------------------------------------------------------------
  // 行動の実行
  // -------------------------------------------------------------------------

  /** プレイヤー／AI 共通の行動処理。発生したイベント列を返す */
  act(action: Action): MatchEvent[] {
    if (this.phase !== 'play') return [];
    const events: MatchEvent[] = [];
    const carrier = this.carrier;

    switch (action.type) {
      case 'dribble':
        this.doDribble(carrier, action.moveId, events);
        break;
      case 'pass':
        this.doPass(carrier, action.targetId, action.moveId, events);
        break;
      case 'shoot':
        this.doShoot(carrier, action.moveId, events);
        break;
      case 'hold':
        this.doHold(carrier, events);
        break;
    }

    this.advanceClock(events);
    return events;
  }

  private doDribble(carrier: PlayerState, moveId: string | null, events: MatchEvent[]): void {
    const dir = this.attackDir(carrier.side);
    const targetZone = clampZone(carrier.zone + dir);
    const move = this.resolveMove(carrier, moveId);
    spendGuts(carrier, BASE_COST.dribble + (move?.cost ?? 0));
    this.keeperCommitted = false;

    if (move) events.push({ type: 'cutIn', text: move.cutIn, playerId: carrier.def.id });

    const defender = this.challengerFor(carrier, targetZone);
    if (!defender) {
      const from = carrier.zone;
      this.setCarrier(carrier.def.id, targetZone, carrier.lane);
      events.push({ type: 'move', carrierId: carrier.def.id, from, to: targetZone, lane: carrier.lane });
      events.push({ type: 'message', text: `${carrier.def.name}、フリーで持ち上がる！` });
      return;
    }

    const defMove = this.autoDefenseMove(defender, 'tackle');
    if (defMove) events.push({ type: 'cutIn', text: defMove.cutIn, playerId: defender.def.id });

    const outcome = resolveDuel(carrier, defender, move, this.rng, defMove);
    events.push({
      type: 'duel',
      attackerId: carrier.def.id,
      defenderId: defender.def.id,
      attackerWon: outcome.attackerWon,
    });

    if (outcome.attackerWon) {
      const from = carrier.zone;
      if (defender.def.pos === 'GK') this.keeperCommitted = true;
      this.setCarrier(carrier.def.id, targetZone, carrier.lane);
      events.push({ type: 'move', carrierId: carrier.def.id, from, to: targetZone, lane: carrier.lane });
      events.push({
        type: 'message',
        text: outcome.decisive
          ? `${carrier.def.name}、${defender.def.name}を完全に置き去りにした！`
          : `${carrier.def.name}、${defender.def.name}をかわした！`,
      });
    } else {
      events.push({
        type: 'message',
        text: outcome.decisive
          ? `${defender.def.name}の完璧なタックル！ボールを奪われた！`
          : `${defender.def.name}に止められた……`,
      });
      this.turnover(defender, events);
    }
  }

  private doPass(
    carrier: PlayerState,
    targetId: string,
    moveId: string | null,
    events: MatchEvent[],
  ): void {
    const target = this.findPlayer(targetId);
    if (!target || target.side !== carrier.side) {
      events.push({ type: 'message', text: 'パスの出しどころがない！' });
      return;
    }
    const move = this.resolveMove(carrier, moveId);
    spendGuts(carrier, BASE_COST.pass + (move?.cost ?? 0));
    this.keeperCommitted = false;

    if (move) events.push({ type: 'cutIn', text: move.cutIn, playerId: carrier.def.id });

    const interceptors = this.interceptorsFor(carrier, target);
    const outcome = resolvePass(carrier, target, interceptors, move, this.rng);

    if (outcome.success) {
      const fromId = carrier.def.id;
      this.setCarrier(target.def.id, target.def.homeZone, target.def.homeLane);
      events.push({ type: 'passBall', fromId, toId: target.def.id });
      events.push({ type: 'message', text: `${carrier.def.name} → ${target.def.name}、パスが通った！` });
    } else {
      const cutter = this.findPlayer(outcome.interceptorId ?? '');
      events.push({
        type: 'message',
        text: cutter ? `${cutter.def.name}にパスをカットされた！` : 'パスが乱れた！',
      });
      if (cutter) this.turnover(cutter, events);
    }
  }

  private doShoot(carrier: PlayerState, moveId: string | null, events: MatchEvent[]): void {
    if (!this.canShoot()) {
      events.push({ type: 'message', text: 'ここからでは遠すぎる！' });
      return;
    }
    const move = this.resolveMove(carrier, moveId);
    spendGuts(carrier, BASE_COST.shoot + (move?.cost ?? 0));

    const foeSide = this.opponentSide(carrier.side);
    const keeper = this.keeperOf(foeSide);
    const blockers = this.blockersFor(carrier);
    const committed = this.keeperCommitted;
    this.keeperCommitted = false;

    if (move) events.push({ type: 'cutIn', text: move.cutIn, playerId: carrier.def.id });
    else events.push({ type: 'message', text: `${carrier.def.name}、シュート！` });

    const keeperMove = committed ? null : this.autoDefenseMove(keeper, 'block');
    if (keeperMove) events.push({ type: 'cutIn', text: keeperMove.cutIn, playerId: keeper.def.id });

    const outcome = resolveShot(carrier, keeper, blockers, move, this.rng, {
      keeperMove,
      keeperCommitted: committed,
    });
    events.push({
      type: 'shot',
      shooterId: carrier.def.id,
      keeperId: keeper.def.id,
      result: outcome.result,
    });

    switch (outcome.result) {
      case 'goal': {
        if (carrier.side === 'home') this.score.home += 1;
        else this.score.away += 1;
        events.push({ type: 'message', text: `ゴォォル！！ ${carrier.def.name}が決めた！！` });
        events.push({ type: 'goal', side: carrier.side, scorerId: carrier.def.id });
        this.kickoff(foeSide);
        events.push({ type: 'message', text: `${this.team(foeSide).def.name}のキックオフ。` });
        break;
      }
      case 'save': {
        events.push({ type: 'message', text: `${keeper.def.name}がガッチリキャッチ！` });
        this.turnover(keeper, events);
        break;
      }
      case 'blocked': {
        const blocker = this.findPlayer(outcome.blockerId ?? '');
        events.push({
          type: 'message',
          text: blocker ? `${blocker.def.name}が体を投げ出してブロック！` : 'ブロックされた！',
        });
        if (blocker) this.turnover(blocker, events);
        break;
      }
      case 'off': {
        events.push({ type: 'message', text: 'シュートは枠を大きく外れた……' });
        this.turnover(keeper, events);
        break;
      }
      case 'rebound': {
        events.push({ type: 'message', text: `${keeper.def.name}が弾いた！ こぼれ球だ！` });
        this.contestRebound(carrier, keeper, events);
        break;
      }
    }
  }

  /** こぼれ球の competition。スピードの高いほうが先に触る */
  private contestRebound(shooter: PlayerState, keeper: PlayerState, events: MatchEvent[]): void {
    const foeSide = this.opponentSide(shooter.side);
    const defenders = this.team(foeSide).players.filter(
      (p) => p.def.pos !== 'GK' && Math.abs(p.zone - shooter.zone) <= 1,
    );
    const defender = defenders.sort((a, b) => b.def.stats.speed - a.def.stats.speed)[0];

    const attackRoll = shooter.def.stats.speed + this.rng.int(0, 30);
    const defenseRoll = (defender?.def.stats.speed ?? keeper.def.stats.speed) + this.rng.int(0, 30);

    if (attackRoll >= defenseRoll) {
      events.push({ type: 'message', text: `${shooter.def.name}がこぼれ球に詰めた！` });
      this.setCarrier(shooter.def.id, shooter.zone, shooter.lane);
    } else {
      const winner = defender ?? keeper;
      events.push({ type: 'message', text: `${winner.def.name}が先に触った！` });
      this.turnover(winner, events);
    }
  }

  private doHold(carrier: PlayerState, events: MatchEvent[]): void {
    recoverGuts(carrier, 8);
    this.keeperCommitted = false;
    const defender = this.challengerFor(carrier, carrier.zone);
    events.push({ type: 'message', text: `${carrier.def.name}、ボールをキープして息を整える。` });

    if (!defender) return;
    const outcome = resolveDuel(carrier, defender, null, this.rng);
    if (!outcome.attackerWon && outcome.decisive) {
      events.push({ type: 'message', text: `そこへ${defender.def.name}！ ボールをつつき出された！` });
      this.turnover(defender, events);
    }
  }

  private turnover(newCarrier: PlayerState, events: MatchEvent[]): void {
    this.keeperCommitted = false;
    this.setCarrier(newCarrier.def.id, newCarrier.zone, newCarrier.lane);
    events.push({ type: 'turnover', to: newCarrier.side });
  }

  // -------------------------------------------------------------------------
  // 時間経過
  // -------------------------------------------------------------------------

  private advanceClock(events: MatchEvent[]): void {
    if (this.phase !== 'play') return;
    this.minute += MINUTES_PER_TURN;
    events.push({ type: 'clock', minute: this.minute });

    if (this.half === 1 && this.minute >= HALF_LENGTH) {
      this.minute = HALF_LENGTH;
      this.phase = 'halftime';
      events.push({ type: 'message', text: '前半終了！' });
      events.push({ type: 'halftime' });
      return;
    }
    if (this.half === 2 && this.minute >= HALF_LENGTH * 2) {
      this.minute = HALF_LENGTH * 2;
      this.phase = 'fulltime';
      events.push({ type: 'message', text: '試合終了！' });
      events.push({ type: 'fulltime' });
    }
  }

  /** ハーフタイムから後半へ。後半は前半にキックオフしなかった側から始める */
  startSecondHalf(): MatchEvent[] {
    this.half = 2;
    this.minute = HALF_LENGTH;
    // ハーフタイムで全選手が少し回復する
    for (const p of this.allPlayers()) recoverGuts(p, Math.round(p.def.stats.maxGuts * 0.35));
    this.kickoff('away');
    return [
      { type: 'message', text: '後半開始！' },
      { type: 'message', text: `${this.away.def.name}のキックオフ。` },
    ];
  }

  // -------------------------------------------------------------------------
  // CPU の思考
  // -------------------------------------------------------------------------

  /** 相手チームの 1 手を選んで実行する */
  aiAct(): MatchEvent[] {
    if (this.phase !== 'play' || this.possession === 'home') return [];
    return this.act(this.chooseAiAction());
  }

  private chooseAiAction(): Action {
    const c = this.carrier;
    const shotMove = c.def.moves.find((m) => m.kind === 'shot' && canUseMove(c, m));
    const dribbleMove = c.def.moves.find((m) => m.kind === 'dribble' && canUseMove(c, m));

    // 撃てる位置なら積極的に撃つ。エースは必殺シュートを惜しまない
    if (this.canShoot()) {
      const distance = Math.abs(this.targetGoalZone(c.side) - c.zone);
      const wantShoot = distance <= 1 ? 0.75 : 0.3;
      if (this.rng.chance(wantShoot)) {
        return { type: 'shoot', moveId: shotMove && c.def.stats.shot >= 60 ? shotMove.id : null };
      }
    }

    // ガッツ切れならキープして回復
    if (c.guts < 12 && this.rng.chance(0.5)) {
      return { type: 'hold' };
    }

    // 前に強い相手がいるならパスで散らす
    const targetZone = clampZone(c.zone + this.attackDir(c.side));
    const challenger = this.challengerFor(c, targetZone);
    const outmatched = challenger ? challenger.def.stats.tackle > c.def.stats.dribble + 8 : false;
    const forwardTargets = this.team(c.side).players.filter(
      (p) => p.def.id !== c.def.id && (p.zone - c.zone) * this.attackDir(c.side) > 0,
    );

    if ((outmatched || this.rng.chance(0.35)) && forwardTargets.length > 0) {
      const best = forwardTargets.sort(
        (a, b) => this.interceptorsFor(c, a).length - this.interceptorsFor(c, b).length,
      )[0]!;
      const passMove = c.def.moves.find((m) => m.kind === 'pass' && canUseMove(c, m));
      return { type: 'pass', targetId: best.def.id, moveId: passMove ? passMove.id : null };
    }

    if (!this.canDribble()) {
      return this.canShoot() ? { type: 'shoot', moveId: shotMove?.id ?? null } : { type: 'hold' };
    }
    return { type: 'dribble', moveId: dribbleMove && outmatched ? dribbleMove.id : null };
  }
}
