/**
 * Regression tests for laser resolution timing bug
 *
 * Bug: Locks and destructions were not being applied immediately after
 * a move that created the targeting condition. Users observed that:
 * - Two robots targeting one enemy would not lock until "next move"
 * - Three lasers on a robot would not destroy until another event
 *
 * Fix: The two-phase resolution pattern correctly applies locks/deaths
 * immediately after the active robot's beam is re-enabled.
 *
 * @see BUG-laser-resolution
 */

import { test, expect } from "@playwright/test";
import { setupSeededGame, waitForGameStateSettled, clickHex } from "../../helpers/game.js";
import { GameStateBuilder } from "@lockitdown/engine";

test.describe("Laser Resolution Timing @regression", () => {
  /**
   * Regression test for BUG-laser-resolution
   *
   * Scenario:
   * - Robot A (Player 0) at arena-E, facing W (already targeting center)
   * - Robot B (Player 0) at arena-W, facing SE (NOT yet targeting center)
   * - Robot C (Player 1) at center (the victim)
   *
   * Action: Robot B turns LEFT to face E (now also targeting center)
   * Expected: Robot C is locked IMMEDIATELY (2 attackers)
   */
  test("@regression locks enemy immediately when second attacker turns to target", async ({
    browser,
  }) => {
    // Build initial state: one stationary attacker, one about to turn, one victim
    const transportState = GameStateBuilder.create()
      .setTurn(0) // Player 0's turn
      .setMovesRemaining(3)
      // Robot A: Player 0 at arena-E, facing W toward center
      .addRobot({
        player: 0,
        position: { q: 2, r: 0 },  // East of center
        direction: "W",            // Facing center
        isBeamEnabled: true,
        isLockedDown: false,
      })
      // Robot B: Player 0 at arena-W, facing SE (not targeting center yet)
      .addRobot({
        player: 0,
        position: { q: -2, r: 0 }, // West of center
        direction: "SE",           // Facing away from center
        isBeamEnabled: true,
        isLockedDown: false,
      })
      // Robot C: Player 1 at center (the victim)
      .addRobot({
        player: 1,
        position: { q: 0, r: 0 },  // Center
        direction: "NW",           // Direction doesn't matter for victim
        isBeamEnabled: true,
        isLockedDown: false,
      })
      .buildTransport();

    // Set up game with seeded state
    const { hostPage, guestPage } = await setupSeededGame(browser, transportState);

    // Verify initial state: victim not locked yet (only 1 attacker)
    const initialState = await hostPage.evaluate(() => {
      const s = (window as any).gameState;
      const victim = s.robots.find((r: any) => r.player === 1);
      return {
        victimLocked: victim?.isLockedDown,
        victimBeamEnabled: victim?.isBeamEnabled,
        robotCount: s.robots.length,
      };
    });
    expect(initialState.victimLocked).toBe(false);
    expect(initialState.victimBeamEnabled).toBe(true);

    // Select Robot B (at -2, 0) and turn LEFT to face E (toward center)
    await clickHex(hostPage, -2, 0);
    await waitForGameStateSettled(hostPage);

    // Click turn-left button
    await hostPage.locator("#btn-turn-left").click();
    await waitForGameStateSettled(hostPage);
    await waitForGameStateSettled(guestPage);

    // === VERIFY: Victim should be locked IMMEDIATELY ===
    const finalState = await hostPage.evaluate(() => {
      const s = (window as any).gameState;
      const victim = s.robots.find((r: any) => r.player === 1);
      const robotA = s.robots.find((r: any) => r.position.q === 2 && r.position.r === 0);
      const robotB = s.robots.find((r: any) => r.position.q === -2 && r.position.r === 0);
      return {
        victimLocked: victim?.isLockedDown,
        victimBeamEnabled: victim?.isBeamEnabled,
        robotALocked: robotA?.isLockedDown,
        robotBLocked: robotB?.isLockedDown,
        robotCount: s.robots.length,
        movesThisTurn: s.movesThisTurn,
      };
    });

    // THE KEY ASSERTION: Victim should be locked IMMEDIATELY after the turn
    expect(finalState.victimLocked).toBe(true);
    expect(finalState.victimBeamEnabled).toBe(false);

    // Attackers should NOT be locked
    expect(finalState.robotALocked).toBe(false);
    expect(finalState.robotBLocked).toBe(false);

    // No robots destroyed (2 attackers = lock, not destroy)
    expect(finalState.robotCount).toBe(3);
  });

  /**
   * Regression test for 3-laser destruction
   *
   * Scenario:
   * - Two robots already targeting victim
   * - Third robot turns to add targeting
   * Expected: Victim is destroyed IMMEDIATELY
   */
  test("@regression destroys enemy immediately when third attacker turns to target", async ({
    browser,
  }) => {
    // Build initial state: two stationary attackers, one about to turn, one victim
    const transportState = GameStateBuilder.create()
      .setTurn(0) // Player 0's turn
      .setMovesRemaining(3)
      // Robot A: Player 0 at east, facing W toward center
      .addRobot({
        player: 0,
        position: { q: 2, r: 0 },
        direction: "W",
        isBeamEnabled: true,
        isLockedDown: false,
      })
      // Robot B: Player 0 at (1, -1), facing SW toward center (0, 0)
      // This is on the SW axis from center
      .addRobot({
        player: 0,
        position: { q: 1, r: -1 },
        direction: "SW",
        isBeamEnabled: true,
        isLockedDown: false,
      })
      // Robot C: Player 0 at west, facing SE (not targeting center yet)
      .addRobot({
        player: 0,
        position: { q: -2, r: 0 },
        direction: "SE",
        isBeamEnabled: true,
        isLockedDown: false,
      })
      // Victim: Player 1 at center
      .addRobot({
        player: 1,
        position: { q: 0, r: 0 },
        direction: "NW",
        isBeamEnabled: true,
        isLockedDown: false,
      })
      .buildTransport();

    const { hostPage, guestPage } = await setupSeededGame(browser, transportState);

    // Verify initial state: victim exists, not locked yet (seeded states don't have resolution applied)
    const initialState = await hostPage.evaluate(() => {
      const s = (window as any).gameState;
      const victim = s.robots.find((r: any) => r.player === 1);
      return {
        victimExists: victim !== undefined,
        victimLocked: victim?.isLockedDown,
        robotCount: s.robots.length,
        player0Points: s.players[0]?.points,
      };
    });
    expect(initialState.victimExists).toBe(true);
    // Note: Seeded states don't have resolution applied, so victim won't be locked initially
    // even though 2 attackers are targeting. The lock will be applied after any move triggers resolution.

    // Select Robot C and turn LEFT to face E (toward center)
    await clickHex(hostPage, -2, 0);
    await waitForGameStateSettled(hostPage);
    await hostPage.locator("#btn-turn-left").click();
    await waitForGameStateSettled(hostPage);
    await waitForGameStateSettled(guestPage);

    // === VERIFY: Victim should be destroyed IMMEDIATELY ===
    const finalState = await hostPage.evaluate(() => {
      const s = (window as any).gameState;
      const victim = s.robots.find((r: any) => r.player === 1);
      return {
        victimExists: victim !== undefined,
        robotCount: s.robots.length,
        player0Points: s.players[0]?.points,
      };
    });

    // THE KEY ASSERTION: Victim should be destroyed
    expect(finalState.victimExists).toBe(false);
    expect(finalState.robotCount).toBe(3); // Only 3 attackers remain

    // Player 0 gets 1 point per attacker that destroyed the victim = 3 points
    expect(finalState.player0Points).toBe(3);
  });
});
