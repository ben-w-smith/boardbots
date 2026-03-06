import { describe, it, expect } from 'vitest';
import {
  NW, NE, E, SE, SW, W,
  CARDINALS,
  pairS,
  pairDist,
  pairAdd,
  pairSub,
  pairRotate,
  inBounds,
  pairKey,
  pairEq,
} from '../hex';

/** Helper to check pair equality (handles -0 vs +0) */
function expectPairEq(actual: { q: number; r: number }, expected: { q: number; r: number }) {
  expect(actual.q === expected.q).toBe(true);
  expect(actual.r === expected.r).toBe(true);
}

describe('pairDist', () => {
  it('returns 0 for origin', () => {
    expect(pairDist({ q: 0, r: 0 })).toBe(0);
  });

  it('returns 1 for adjacent hexes', () => {
    expect(pairDist(E)).toBe(1);
    expect(pairDist(W)).toBe(1);
    expect(pairDist(NW)).toBe(1);
    expect(pairDist(NE)).toBe(1);
    expect(pairDist(SE)).toBe(1);
    expect(pairDist(SW)).toBe(1);
  });

  it('returns correct distance for various positions', () => {
    expect(pairDist({ q: 2, r: -1 })).toBe(2);
    expect(pairDist({ q: 3, r: -2 })).toBe(3);
    expect(pairDist({ q: -2, r: 2 })).toBe(2);
    expect(pairDist({ q: 0, r: 5 })).toBe(5);
    expect(pairDist({ q: -3, r: -2 })).toBe(5);
  });
});

describe('pairRotate', () => {
  it('rotates E right through all cardinals', () => {
    let current = E;
    expectPairEq(pairRotate(current, 'right'), SE);
    current = pairRotate(current, 'right');
    expectPairEq(current, SE);
    current = pairRotate(current, 'right');
    expectPairEq(current, SW);
    current = pairRotate(current, 'right');
    expectPairEq(current, W);
    current = pairRotate(current, 'right');
    expectPairEq(current, NW);
    current = pairRotate(current, 'right');
    expectPairEq(current, NE);
    current = pairRotate(current, 'right');
    expectPairEq(current, E); // Full rotation
  });

  it('rotates E left through all cardinals', () => {
    let current = E;
    expectPairEq(pairRotate(current, 'left'), NE);
    current = pairRotate(current, 'left');
    expectPairEq(current, NE);
    current = pairRotate(current, 'left');
    expectPairEq(current, NW);
    current = pairRotate(current, 'left');
    expectPairEq(current, W);
    current = pairRotate(current, 'left');
    expectPairEq(current, SW);
    current = pairRotate(current, 'left');
    expectPairEq(current, SE);
    current = pairRotate(current, 'left');
    expectPairEq(current, E); // Full rotation
  });

  it('rotates all 6 cardinals left and right correctly', () => {
    for (const cardinal of CARDINALS) {
      const leftRotated = pairRotate(cardinal, 'left');
      const rightRotated = pairRotate(cardinal, 'right');

      // Rotating left then right should get back to original
      expectPairEq(pairRotate(leftRotated, 'right'), cardinal);
      expectPairEq(pairRotate(rightRotated, 'left'), cardinal);

      // Distance should remain 1 (unit vectors)
      expect(pairDist(leftRotated)).toBe(1);
      expect(pairDist(rightRotated)).toBe(1);
    }
  });
});

describe('inBounds', () => {
  it('returns true for origin with any positive radius', () => {
    expect(inBounds(1, { q: 0, r: 0 })).toBe(true);
    expect(inBounds(5, { q: 0, r: 0 })).toBe(true);
  });

  it('returns true for positions at boundary', () => {
    expect(inBounds(5, { q: 5, r: 0 })).toBe(true);
    expect(inBounds(5, { q: 0, r: 5 })).toBe(true);
    expect(inBounds(5, { q: -5, r: 5 })).toBe(true);
    expect(inBounds(5, { q: 3, r: -3 })).toBe(true); // distance = (3+3+0)/2 = 3 <= 5
  });

  it('returns false for positions outside boundary', () => {
    expect(inBounds(5, { q: 6, r: 0 })).toBe(false);
    expect(inBounds(5, { q: 0, r: 6 })).toBe(false);
    expect(inBounds(5, { q: -3, r: 6 })).toBe(false);
  });

  it('handles edge case at radius 0', () => {
    expect(inBounds(0, { q: 0, r: 0 })).toBe(true);
    expect(inBounds(0, { q: 1, r: 0 })).toBe(false);
  });
});

describe('pairKey', () => {
  it('generates unique keys for different pairs', () => {
    const keys = new Set<string>();
    for (let q = -2; q <= 2; q++) {
      for (let r = -2; r <= 2; r++) {
        keys.add(pairKey({ q, r }));
      }
    }
    // 5x5 = 25 unique pairs
    expect(keys.size).toBe(25);
  });

  it('generates consistent keys', () => {
    expect(pairKey({ q: 3, r: -5 })).toBe('3,-5');
    expect(pairKey({ q: 0, r: 0 })).toBe('0,0');
    expect(pairKey({ q: -2, r: 1 })).toBe('-2,1');
  });
});

describe('pairAdd', () => {
  it('adds two pairs correctly', () => {
    expect(pairAdd({ q: 1, r: 2 }, { q: 3, r: 4 })).toEqual({ q: 4, r: 6 });
    expect(pairAdd({ q: -1, r: 0 }, { q: 1, r: 0 })).toEqual({ q: 0, r: 0 });
  });

  it('does not mutate inputs', () => {
    const a = { q: 1, r: 2 };
    const b = { q: 3, r: 4 };
    pairAdd(a, b);
    expect(a).toEqual({ q: 1, r: 2 });
    expect(b).toEqual({ q: 3, r: 4 });
  });
});

describe('pairSub', () => {
  it('subtracts two pairs correctly', () => {
    expect(pairSub({ q: 5, r: 3 }, { q: 2, r: 1 })).toEqual({ q: 3, r: 2 });
    expect(pairSub({ q: 1, r: 1 }, { q: 1, r: 1 })).toEqual({ q: 0, r: 0 });
  });

  it('does not mutate inputs', () => {
    const a = { q: 5, r: 3 };
    const b = { q: 2, r: 1 };
    pairSub(a, b);
    expect(a).toEqual({ q: 5, r: 3 });
    expect(b).toEqual({ q: 2, r: 1 });
  });
});

describe('pairEq', () => {
  it('returns true for equal pairs', () => {
    expect(pairEq({ q: 1, r: 2 }, { q: 1, r: 2 })).toBe(true);
    expect(pairEq({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(true);
  });

  it('returns false for different pairs', () => {
    expect(pairEq({ q: 1, r: 2 }, { q: 2, r: 1 })).toBe(false);
    expect(pairEq({ q: 1, r: 0 }, { q: 0, r: 0 })).toBe(false);
  });
});

describe('pairS', () => {
  it('derives the third cubic axis correctly', () => {
    // Using === comparison to handle -0 vs +0 (they are equal with ===)
    expect(pairS({ q: 0, r: 0 }) === 0).toBe(true);
    expect(pairS({ q: 1, r: 0 })).toBe(-1);
    expect(pairS({ q: 1, r: -1 }) === 0).toBe(true);
    expect(pairS({ q: -2, r: 1 })).toBe(1);
  });
});
