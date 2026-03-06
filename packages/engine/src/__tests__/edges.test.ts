import { describe, it, expect } from 'vitest';
import { computeEdges } from '../edges';
import { pairDist, pairAdd } from '../hex';

describe('computeEdges', () => {
  it('returns placements for ring size 5', () => {
    const edges = computeEdges(5);
    // Corridor ring at distance 5 has 6*5 = 30 hexes
    // Each hex can have multiple valid inward-facing directions
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.length).toBeLessThan(30 * 6 + 1);
  });

  it('only includes placements that face inward', () => {
    const ringSize = 5;
    const edges = computeEdges(ringSize);

    for (const placement of edges) {
      // All positions should be on the corridor ring (distance = ringSize)
      expect(pairDist(placement.position)).toBe(ringSize);

      // The facing position (position + direction) should be in bounds (distance <= ringSize)
      const facingPosition = pairAdd(placement.position, placement.direction);
      expect(pairDist(facingPosition)).toBeLessThanOrEqual(ringSize);
    }
  });

  it('caches results', () => {
    const edges1 = computeEdges(3);
    const edges2 = computeEdges(3);
    expect(edges1).toBe(edges2); // Same reference (cached)
  });

  it('returns consistent placements', () => {
    const edges1 = computeEdges(4);
    const edges2 = computeEdges(4);
    expect(edges1).toEqual(edges2);
  });
});
