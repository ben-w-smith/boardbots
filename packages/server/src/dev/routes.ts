import { Router, Request, Response, NextFunction } from "express";
import { RoomManager } from "../RoomManager.js";
import { dbService } from "../db.js";
import type { TransportState } from "@lockitdown/engine";

const router = Router();

/**
 * Middleware to ensure dev-only endpoints are only accessible in non-production environments
 */
export function devOnly(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Dev endpoints are not available in production" });
    return;
  }
  next();
}

/**
 * POST /api/dev/seed-state
 * Seed a game room with a specific game state
 *
 * Request body:
 * {
 *   "gameCode": "ABCDEF",
 *   "state": TransportState
 * }
 */
router.post("/seed-state", devOnly, (req: Request, res: Response) => {
  const { gameCode, state } = req.body;

  // Validate request body
  if (!gameCode || typeof gameCode !== "string") {
    res.status(400).json({ error: "gameCode is required and must be a string" });
    return;
  }

  if (!state || typeof state !== "object") {
    res.status(400).json({ error: "state is required and must be an object" });
    return;
  }

  // Normalize game code to uppercase
  const normalizedGameCode = gameCode.toUpperCase().trim();

  // Look up the room
  const roomManager = RoomManager.getInstance();
  const rooms = (roomManager as any).rooms as Map<string, import("../game-room.js").GameRoom>;
  const room = rooms.get(normalizedGameCode);

  if (!room) {
    res.status(404).json({ error: `Room ${normalizedGameCode} not found` });
    return;
  }

  try {
    // Set the game state (this will broadcast to all connected clients)
    room.setGameState(state as TransportState);

    res.status(200).json({
      success: true,
      gameCode: normalizedGameCode,
      message: "Game state seeded successfully",
    });
  } catch (error) {
    console.error("Error seeding game state:", error);
    res.status(500).json({
      error: "Failed to seed game state",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/dev/room/:gameCode
 * Get the current state of a room (for debugging)
 */
router.get("/room/:gameCode", devOnly, (req: Request, res: Response) => {
  const { gameCode } = req.params;
  // Ensure gameCode is a string (Express params can be string | string[])
  const code = Array.isArray(gameCode) ? gameCode[0] : gameCode;
  const normalizedGameCode = code.toUpperCase().trim();

  const roomManager = RoomManager.getInstance();
  const rooms = (roomManager as any).rooms as Map<string, import("../game-room.js").GameRoom>;
  const room = rooms.get(normalizedGameCode);

  if (!room) {
    res.status(404).json({ error: `Room ${normalizedGameCode} not found` });
    return;
  }

  const state = room.getRoomState();
  res.status(200).json({
    gameCode: normalizedGameCode,
    phase: state.phase,
    gameState: state.gameState,
    players: state.players,
  });
});

/**
 * POST /api/dev/reset-db
 * Clear all data from the SQLite database
 */
router.post("/reset-db", devOnly, (req: Request, res: Response) => {
  try {
    dbService.resetDatabase();

    res.status(200).json({
      success: true,
      message: "Database reset successfully",
    });
  } catch (error) {
    console.error("Error resetting database:", error);
    res.status(500).json({
      error: "Failed to reset database",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/dev/health
 * Health check for dev endpoints
 */
router.get("/health", devOnly, (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
