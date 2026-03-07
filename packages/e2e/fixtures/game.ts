import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
  type Browser,
} from "@playwright/test";
import { setupGame } from "../helpers/game.js";

// Serializable subset of the game state for assertions
interface SerializedRobot {
  position: { q: number; r: number };
  direction: { q: number; r: number };
  isBeamEnabled: boolean;
  isLockedDown: boolean;
  player: number;
}

interface SerializedGameState {
  playerTurn: number;
  movesThisTurn: number;
  robots: SerializedRobot[];
  gameDef: {
    movesPerTurn: number;
    robotsPerPlayer: number;
    board: { hexaBoard: { arenaRadius: number } };
  };
  players: { points: number; placedRobots: number }[];
}

interface GameBoard {
  /** Click on a hex at axial coordinates (q, r) on the canvas */
  clickHex(q: number, r: number): Promise<void>;
  /** Get the full game state (serialized for cross-context transfer) */
  getGameState(): Promise<SerializedGameState>;
  /** Wait until it's the given player's turn */
  waitForTurn(playerIndex: number): Promise<void>;
  /** Wait for all animations to finish */
  waitForAnimations(): Promise<void>;
  /** Wait for a specific number of robots to exist on the board */
  waitForRobotCount(count: number): Promise<void>;
}

interface GameWithPlayers {
  hostCtx: BrowserContext;
  guestCtx: BrowserContext;
  hostPage: Page;
  guestPage: Page;
}

export const test = base.extend<{ gameBoard: GameBoard; gameWithPlayers: GameWithPlayers }>({
  gameBoard: async ({ page }, use) => {
    await use({
      async clickHex(q: number, r: number) {
        const coords = await page.evaluate(
          ({ q, r }) => {
            const w = window as any;
            return w.renderer.getPixelFromHex(q, r);
          },
          { q, r },
        );
        await page.locator("#gameCanvas").click({
          position: { x: coords.x, y: coords.y },
          force: true,
        });
      },

      async getGameState(): Promise<SerializedGameState> {
        return page.evaluate(() => {
          const s = (window as any).gameState;
          return JSON.parse(JSON.stringify(s));
        });
      },

      async waitForTurn(playerIndex: number) {
        await page.waitForFunction(
          (idx) => (window as any).gameState?.playerTurn === idx,
          playerIndex,
          { timeout: 10_000 },
        );
      },

      async waitForAnimations() {
        await page.waitForFunction(async () => {
          const a = (window as any).animator;
          if (!a || !a.isAnimating()) {
            // Wait two frames to be sure
            await new Promise((r) => requestAnimationFrame(r));
            await new Promise((r) => requestAnimationFrame(r));
            return !a || !a.isAnimating();
          }
          return false;
        });
      },

      async waitForRobotCount(count: number) {
        await page.waitForFunction(
          (c) => (window as any).gameState?.robots?.length === c,
          count,
          { timeout: 10_000 },
        );
      },
    });
  },

  gameWithPlayers: async ({ browser }, use) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await setupGame(browser);
    await use({ hostCtx, guestCtx, hostPage, guestPage });
    await hostCtx.close();
    await guestCtx.close();
  },
});

export { expect };
