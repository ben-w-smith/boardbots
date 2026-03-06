import type { Pair, TurnDirection } from './types.js';

// Cardinal directions (axial coordinates)
export const NW: Pair = { q: 0,  r: -1 };
export const NE: Pair = { q: 1,  r: -1 };
export const E:  Pair = { q: 1,  r: 0  };
export const SE: Pair = { q: 0,  r: 1  };
export const SW: Pair = { q: -1, r: 1  };
export const W:  Pair = { q: -1, r: 0  };

export const CARDINALS: readonly Pair[] = [E, SE, SW, W, NW, NE];

/** Derive the third cubic axis */
export function pairS(p: Pair): number {
  return -p.q - p.r;
}

/** Hex distance from origin */
export function pairDist(p: Pair): number {
  return (Math.abs(p.q) + Math.abs(p.r) + Math.abs(pairS(p))) / 2;
}

/** Create a new pair = a + b (immutable) */
export function pairAdd(a: Pair, b: Pair): Pair {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** Create a new pair = a - b (immutable) */
export function pairSub(a: Pair, b: Pair): Pair {
  return { q: a.q - b.q, r: a.r - b.r };
}

/** Rotate a unit direction vector 60° left or right */
export function pairRotate(p: Pair, direction: TurnDirection): Pair {
  const s = pairS(p);
  if (direction === 'right') {
    return { q: -p.r, r: -s };
  } else {
    return { q: -s, r: -p.q };
  }
}

/** Check if position is within the hex grid bounds */
export function inBounds(radius: number, position: Pair): boolean {
  return pairDist(position) <= radius;
}

/** Unique string key for a Pair (for use as Map keys) */
export function pairKey(p: Pair): string {
  return `${p.q},${p.r}`;
}

/** Check if two pairs are equal */
export function pairEq(a: Pair, b: Pair): boolean {
  return a.q === b.q && a.r === b.r;
}
