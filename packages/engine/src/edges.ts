import type { Pair } from './types.js';
import { CARDINALS, pairAdd, pairDist, inBounds } from './hex.js';

export interface Placement {
  position: Pair;
  direction: Pair;
}

// Cache for computed edges by ring size
const cache: Map<number, Placement[]> = new Map();

/** Return the minimum absolute coordinate value of a pair */
function minCoord(p: Pair): number {
  const abQ = Math.abs(p.q);
  const abR = Math.abs(p.r);
  const abS = Math.abs(-p.q - p.r);
  return Math.min(abQ, abR, abS);
}

/** Compare placements by corner order for sorting */
function byCorner(a: Placement, b: Placement): number {
  return minCoord(a.position) - minCoord(b.position);
}

/** Compute all valid corridor placement positions for a given ring size */
export function computeEdges(ringSize: number): Placement[] {
  const cached = cache.get(ringSize);
  if (cached) {
    return cached;
  }

  const edges: Placement[] = [];

  // Top left starting position
  const cursor: Pair = { q: 0, r: -ringSize };

  // Walk all 6 sides of the corridor ring
  for (let side = 0; side < 6; side++) {
    const dir = CARDINALS[side];
    for (let hex = 0; hex < ringSize; hex++) {
      // Move cursor along this side
      cursor.q += dir.q;
      cursor.r += dir.r;

      // Check all 6 facing directions for this corridor hex
      for (const placeDirection of CARDINALS) {
        // Check if robot would face inward (toward arena)
        const facingPosition = pairAdd(cursor, placeDirection);
        if (inBounds(ringSize, facingPosition)) {
          edges.push({
            position: { q: cursor.q, r: cursor.r },
            direction: placeDirection,
          });
        }
      }
    }
  }

  // Sort by corner order
  edges.sort(byCorner);

  cache.set(ringSize, edges);
  return edges;
}
