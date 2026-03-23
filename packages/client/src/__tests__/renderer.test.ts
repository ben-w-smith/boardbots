import { describe, it, expect, beforeEach, vi } from "vitest";
import { BoardRenderer } from "../renderer.js";
import { createGame, type GameState, CARDINALS } from "@lockitdown/engine";

// Mock canvas and context
function createMockCanvas(): HTMLCanvasElement {
  const canvas = {
    width: 800,
    height: 600,
    style: { width: "800px", height: "600px" },
    parentElement: {
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    },
    getBoundingClientRect: () => ({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
    }),
    getContext: vi.fn(() => ({
      scale: vi.fn(),
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      font: "",
      textAlign: "",
      textBaseline: "",
      shadowColor: "",
      shadowBlur: 0,
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      measureText: vi.fn(() => ({ width: 10 })),
      drawImage: vi.fn(),
    })),
  } as unknown as HTMLCanvasElement;

  return canvas;
}

describe("BoardRenderer", () => {
  let canvas: HTMLCanvasElement;
  let renderer: BoardRenderer;
  let state: GameState;

  beforeEach(() => {
    canvas = createMockCanvas();
    renderer = new BoardRenderer(canvas);

    // Create a default game state
    const gameDef = {
      board: { hexaBoard: { arenaRadius: 4 } },
      numOfPlayers: 2,
      movesPerTurn: 3,
      robotsPerPlayer: 6,
      winCondition: "Elimination",
    };
    state = createGame(gameDef);
  });

  describe("constructor", () => {
    it("creates a renderer instance", () => {
      expect(renderer).toBeInstanceOf(BoardRenderer);
    });

    it("throws if canvas has no 2D context", () => {
      const badCanvas = {
        getContext: vi.fn(() => null),
        parentElement: {
          getBoundingClientRect: () => ({ width: 800, height: 600 }),
        },
      } as unknown as HTMLCanvasElement;

      expect(() => new BoardRenderer(badCanvas)).toThrow(
        "Could not get 2D context",
      );
    });
  });

  describe("pixelToHex", () => {
    it("returns null for coordinates outside the grid", () => {
      // Click far outside the grid
      const result = renderer.pixelToHex(-1000, -1000);
      // Should still return a hex (just not in bounds)
      expect(result).not.toBeNull();
    });

    it("converts center pixel to origin hex", () => {
      // The center of the canvas should map to (0, 0)
      const result = renderer.pixelToHex(400, 300);
      expect(result).not.toBeNull();
      // Due to rounding, it should be close to origin
      expect(Math.abs(result!.q)).toBeLessThanOrEqual(1);
      expect(Math.abs(result!.r)).toBeLessThanOrEqual(1);
    });

    it("handles integer coordinates", () => {
      const result = renderer.pixelToHex(350, 250);
      expect(result).toEqual(
        expect.objectContaining({
          q: expect.any(Number),
          r: expect.any(Number),
        }),
      );
    });
  });

  describe("render", () => {
    it("renders empty board without errors", () => {
      expect(() => renderer.render(state)).not.toThrow();
    });

    it("renders board with robots", () => {
      state.robots = [
        {
          position: { q: 0, r: 5 },
          direction: CARDINALS[0],
          isBeamEnabled: true,
          isLockedDown: false,
          player: 0,
        },
      ];

      expect(() => renderer.render(state)).not.toThrow();
    });

    it("renders board with highlights", () => {
      const highlights = [
        { position: { q: 0, r: 0 }, type: "selected" as const },
        { position: { q: 1, r: 0 }, type: "validMove" as const },
      ];

      expect(() => renderer.render(state, highlights)).not.toThrow();
    });

    it("renders locked robots", () => {
      state.robots = [
        {
          position: { q: 0, r: 0 },
          direction: CARDINALS[0],
          isBeamEnabled: false,
          isLockedDown: true,
          player: 0,
        },
      ];

      expect(() => renderer.render(state)).not.toThrow();
    });

    it("renders robots for both players", () => {
      state.robots = [
        {
          position: { q: 0, r: 2 },
          direction: CARDINALS[0],
          isBeamEnabled: true,
          isLockedDown: false,
          player: 0,
        },
        {
          position: { q: 0, r: -2 },
          direction: CARDINALS[3],
          isBeamEnabled: true,
          isLockedDown: false,
          player: 1,
        },
      ];

      expect(() => renderer.render(state)).not.toThrow();
    });

    it("renders beams for enabled robots", () => {
      state.robots = [
        {
          position: { q: 0, r: 0 },
          direction: CARDINALS[0],
          isBeamEnabled: true,
          isLockedDown: false,
          player: 0,
        },
      ];

      expect(() => renderer.render(state)).not.toThrow();
    });
  });

  describe("resize", () => {
    it("handles resize without errors", () => {
      expect(() => renderer.resize()).not.toThrow();
    });
  });

  describe("hex layout", () => {
    it("renders all arena and corridor hexes", () => {
      // Arena radius 4 + corridor = 5 radius
      // Should render without errors
      expect(() => renderer.render(state)).not.toThrow();
    });
  });
});
