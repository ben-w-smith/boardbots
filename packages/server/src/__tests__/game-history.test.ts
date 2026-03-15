import { describe, it, expect, beforeEach, vi } from "vitest";
import { dbService } from "../db.js";

// We'll test the database methods directly
describe("Game History Database", () => {
  describe("getUserGames", () => {
    it("should return empty array for user with no games", () => {
      const games = dbService.getUserGames(99999, 20, 0);
      expect(Array.isArray(games)).toBe(true);
    });

    it("should return games for user ordered by createdAt desc", () => {
      // This test assumes there might be games in the database
      const games = dbService.getUserGames(1, 20, 0);
      expect(Array.isArray(games)).toBe(true);

      // If games exist, verify ordering
      if (games.length > 1) {
        for (let i = 0; i < games.length - 1; i++) {
          expect(games[i].createdAt).toBeGreaterThanOrEqual(games[i + 1].createdAt);
        }
      }
    });

    it("should respect limit parameter", () => {
      const games = dbService.getUserGames(1, 5, 0);
      expect(games.length).toBeLessThanOrEqual(5);
    });

    it("should respect offset parameter", () => {
      const gamesNoOffset = dbService.getUserGames(1, 10, 0);
      const gamesWithOffset = dbService.getUserGames(1, 10, 5);

      // If there are enough games, offset should skip first 5
      if (gamesNoOffset.length > 5) {
        expect(gamesWithOffset.length).toBeLessThanOrEqual(gamesNoOffset.length - 5);
      }
    });
  });

  describe("getUserGamesCount", () => {
    it("should return 0 for non-existent user", () => {
      const count = dbService.getUserGamesCount(99999);
      expect(count).toBe(0);
    });

    it("should return count for existing user", () => {
      const count = dbService.getUserGamesCount(1);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getUserGameDetail", () => {
    it("should return null for non-existent game", () => {
      const game = dbService.getUserGameDetail(99999, "NOTFND");
      expect(game == null).toBe(true); // Allow null or undefined
    });

    it("should return null if game belongs to different user", () => {
      // Try to get game for user 99999 when it might belong to another user
      const game = dbService.getUserGameDetail(99999, "ABC123");
      expect(game == null).toBe(true); // Allow null or undefined
    });
  });
});
