/**
 * Direction and position aliases for test readability
 */

import type { Pair } from '../types.js';
import { E, SE, SW, W, NW, NE } from '../hex.js';

// ============================================================================
// DIRECTION ALIASES
// ============================================================================

/** Named directions matching hex cardinal directions */
export type DirectionName = 'E' | 'SE' | 'SW' | 'W' | 'NW' | 'NE';

/** Map direction names to Pair vectors */
export const DIRECTIONS: Record<DirectionName, Pair> = {
  E: E,
  SE: SE,
  SW: SW,
  W: W,
  NW: NW,
  NE: NE,
};

// ============================================================================
// POSITION ALIASES
// ============================================================================

/** Named positions for common test scenarios */
export type PositionName =
  // Arena center
  | 'center'
  // Arena ring (radius 1) - using direction names
  | 'arena-E'
  | 'arena-SE'
  | 'arena-SW'
  | 'arena-W'
  | 'arena-NW'
  | 'arena-NE'
  // Corridor hexes (radius 5)
  | 'corridor-N'
  | 'corridor-NE'
  | 'corridor-E'
  | 'corridor-SE'
  | 'corridor-S'
  | 'corridor-SW'
  | 'corridor-W'
  | 'corridor-NW';

/**
 * Position aliases keyed by name.
 *
 * Arena positions are at radius 1 (adjacent to center).
 * Corridor positions are at radius 5 (placement zone).
 */
export const POSITIONS: Record<PositionName, Pair> = {
  // Arena center
  center: { q: 0, r: 0 },

  // Arena ring (radius 1) - 6 neighbors matching hex directions
  'arena-E': { q: 1, r: 0 },
  'arena-SE': { q: 0, r: 1 },
  'arena-SW': { q: -1, r: 1 },
  'arena-W': { q: -1, r: 0 },
  'arena-NW': { q: 0, r: -1 },
  'arena-NE': { q: 1, r: -1 },

  // Corridor (radius 5) - key entry points
  'corridor-N': { q: 0, r: -5 },
  'corridor-NE': { q: 3, r: -5 },
  'corridor-E': { q: 5, r: -2 },
  'corridor-SE': { q: 5, r: 3 },
  'corridor-S': { q: 0, r: 5 },
  'corridor-SW': { q: -5, r: 5 },
  'corridor-W': { q: -5, r: 0 },
  'corridor-NW': { q: -3, r: -2 },
};
