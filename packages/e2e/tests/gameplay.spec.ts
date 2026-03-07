import { test, expect } from "../fixtures/game";
import { POSITIONS } from "../helpers/constants";

test.describe("Gameplay", () => {
  test("game starts with player 0 turn and 3 moves", async ({
    gameWithPlayers: { hostPage },
  }) => {
    const state = await hostPage.evaluate(() => {
      const s = (window as any).gameState;
      return { playerTurn: s.playerTurn, movesThisTurn: s.movesThisTurn };
    });
    expect(state.playerTurn).toBe(0);
    expect(state.movesThisTurn).toBe(3);
  });

  test("host can place a robot on corridor hex", async ({
    gameWithPlayers: { hostPage },
  }) => {
    // Click corridor hex at (0, 5) — south edge
    const coords = await hostPage.evaluate(
      (pos: { q: number; r: number }) =>
        (window as any).renderer.getPixelFromHex(pos.q, pos.r),
      POSITIONS.CORRIDOR_SOUTH,
    );
    await hostPage
      .locator("#gameCanvas")
      .click({ position: { x: coords.x, y: coords.y }, force: true });

    // Click the hex in the NW direction (0, 4) to set facing toward center
    const dirCoords = await hostPage.evaluate(
      (pos: { q: number; r: number }) =>
        (window as any).renderer.getPixelFromHex(pos.q, pos.r),
      POSITIONS.ARENA_ENTRY_SOUTH,
    );
    await hostPage
      .locator("#gameCanvas")
      .click({ position: { x: dirCoords.x, y: dirCoords.y }, force: true });

    // Wait for robot to appear
    await hostPage.waitForFunction(
      () => (window as any).gameState?.robots?.length > 0,
      null,
      { timeout: 5_000 },
    );

    const robots = await hostPage.evaluate(() =>
      JSON.parse(JSON.stringify((window as any).gameState.robots)),
    );
    expect(robots.length).toBeGreaterThan(0);
    const placed = robots.find(
      (r: any) =>
        r.position.q === POSITIONS.CORRIDOR_SOUTH.q &&
        r.position.r === POSITIONS.CORRIDOR_SOUTH.r,
    );
    expect(placed).toBeDefined();
    expect(placed.player).toBe(0);
  });
});
