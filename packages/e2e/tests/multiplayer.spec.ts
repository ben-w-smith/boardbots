import { test, expect } from "../fixtures/game";
import { POSITIONS } from "../helpers/constants";

test.describe("Multiplayer Sync", () => {
  test("host placement is visible on guest client", async ({
    gameWithPlayers: { hostPage, guestPage },
  }) => {
    // Host places a robot at (0, 5) facing NW
    const placeCoords = await hostPage.evaluate(
      (pos: { q: number; r: number }) =>
        (window as any).renderer.getPixelFromHex(pos.q, pos.r),
      POSITIONS.CORRIDOR_SOUTH,
    );
    await hostPage
      .locator("#gameCanvas")
      .click({ position: { x: placeCoords.x, y: placeCoords.y }, force: true });

    const dirCoords = await hostPage.evaluate(
      (pos: { q: number; r: number }) =>
        (window as any).renderer.getPixelFromHex(pos.q, pos.r),
      POSITIONS.ARENA_ENTRY_SOUTH,
    );
    await hostPage
      .locator("#gameCanvas")
      .click({ position: { x: dirCoords.x, y: dirCoords.y }, force: true });

    // Verify the robot appears on the GUEST's game state
    await guestPage.waitForFunction(
      () => (window as any).gameState?.robots?.length > 0,
      null,
      { timeout: 10_000 },
    );

    const guestRobots = await guestPage.evaluate(() =>
      JSON.parse(JSON.stringify((window as any).gameState.robots)),
    );
    const synced = guestRobots.find(
      (r: any) =>
        r.position.q === POSITIONS.CORRIDOR_SOUTH.q &&
        r.position.r === POSITIONS.CORRIDOR_SOUTH.r,
    );
    expect(synced).toBeDefined();
    expect(synced.player).toBe(0);
  });
});
