/**
 * 再現可能な擬似乱数生成器（mulberry32）。
 * シードを固定すれば試合展開を完全に再現できるので、テストとリプレイ検証に使う。
 */
export class Rng {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  /** 0 以上 1 未満 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** min 以上 max 以下の整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 確率 p（0〜1）で true */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 配列からひとつ選ぶ。空配列なら null */
  pick<T>(items: readonly T[]): T | null {
    if (items.length === 0) return null;
    return items[Math.floor(this.next() * items.length)]!;
  }
}
