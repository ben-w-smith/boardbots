/**
 * Named hex positions on the game board.
 * Use these for consistent test positioning.
 */
export const POSITIONS = {
  // Corridor positions (outside the arena)
  CORRIDOR_SOUTH: { q: 0, r: 5 },
  CORRIDOR_NORTH: { q: 0, r: -5 },
  CORRIDOR_EAST: { q: 5, r: 0 },
  CORRIDOR_WEST: { q: -5, r: 0 },

  // Arena entry positions (just inside the arena)
  ARENA_ENTRY_SOUTH: { q: 0, r: 4 },
  ARENA_ENTRY_NORTH: { q: 0, r: -4 },
  ARENA_ENTRY_EAST: { q: 4, r: 0 },
  ARENA_ENTRY_WEST: { q: -4, r: 0 },

  // Center of the arena
  CENTER: { q: 0, r: 0 },
};

/**
 * Direction vectors for robot facing.
 * These match the engine's direction system.
 */
export const DIRECTIONS = {
  E: { q: 1, r: 0 },
  SE: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  W: { q: -1, r: 0 },
  NW: { q: 0, r: -1 },
  NE: { q: 1, r: -1 },
};
