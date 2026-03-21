import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import devRoutes, { devOnly } from "../dev/routes.js";
import { RoomManager } from "../RoomManager.js";
import { GameRoom } from "../game-room.js";
import { dbService } from "../db.js";

// Mock the dependencies
vi.mock("../RoomManager.js", () => ({
  RoomManager: {
    getInstance: vi.fn(),
  },
}));

describe("Dev Routes", () => {
  let app: express.Application;
  let mockRooms: Map<string, any>;
  let mockRoom: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up mock room
    mockRoom = {
      setGameState: vi.fn(),
      getRoomState: vi.fn().mockReturnValue({
        gameCode: "ABCDEF",
        phase: "playing",
        gameState: null,
        players: [],
      }),
    };

    mockRooms = new Map([["ABCDEF", mockRoom]]);

    // Set up mock RoomManager
    const mockRoomManager = {
      rooms: mockRooms,
    };

    vi.mocked(RoomManager.getInstance).mockReturnValue(mockRoomManager as any);

    // Mock dbService
    vi.spyOn(dbService, "resetDatabase").mockImplementation(() => {});

    // Create test app
    app = express();
    app.use(express.json());
    app.use("/api/dev", devRoutes);

    // Ensure NODE_ENV is not production for tests
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = "test";
  });

  describe("devOnly middleware", () => {
    it("should allow requests in non-production environments", async () => {
      const req: any = { path: "/api/dev/health" };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      devOnly(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should block requests in production environment", async () => {
      process.env.NODE_ENV = "production";

      const req: any = { path: "/api/dev/health" };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      devOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Dev endpoints are not available in production",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/dev/health", () => {
    it("should return health status in development", async () => {
      const response = await request(app)
        .get("/api/dev/health")
        .expect(200);

      expect(response.body).toEqual({
        status: "ok",
        environment: "test",
      });
    });

    it("should return 403 in production", async () => {
      process.env.NODE_ENV = "production";

      const response = await request(app)
        .get("/api/dev/health")
        .expect(403);

      expect(response.body).toEqual({
        error: "Dev endpoints are not available in production",
      });

      process.env.NODE_ENV = "test";
    });
  });

  describe("POST /api/dev/seed-state", () => {
    const validState = {
      gameDef: {
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: "Elimination",
      },
      players: [{ points: 0, placedRobots: 0 }, { points: 0, placedRobots: 0 }],
      robots: [],
      playerTurn: 1,
      status: "OnGoing",
      movesThisTurn: 0,
      requiresTieBreak: false,
    };

    it("should seed state to an existing room", async () => {
      const response = await request(app)
        .post("/api/dev/seed-state")
        .send({
          gameCode: "ABCDEF",
          state: validState,
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        gameCode: "ABCDEF",
        message: "Game state seeded successfully",
      });
      expect(mockRoom.setGameState).toHaveBeenCalledWith(validState);
    });

    it("should normalize game code to uppercase", async () => {
      const response = await request(app)
        .post("/api/dev/seed-state")
        .send({
          gameCode: "abcdef",
          state: validState,
        })
        .expect(200);

      expect(response.body.gameCode).toBe("ABCDEF");
    });

    it("should return 400 if gameCode is missing", async () => {
      const response = await request(app)
        .post("/api/dev/seed-state")
        .send({ state: validState })
        .expect(400);

      expect(response.body).toEqual({
        error: "gameCode is required and must be a string",
      });
    });

    it("should return 400 if state is missing", async () => {
      const response = await request(app)
        .post("/api/dev/seed-state")
        .send({ gameCode: "ABCDEF" })
        .expect(400);

      expect(response.body).toEqual({
        error: "state is required and must be an object",
      });
    });

    it("should return 404 if room does not exist", async () => {
      const response = await request(app)
        .post("/api/dev/seed-state")
        .send({
          gameCode: "NOTFOUND",
          state: validState,
        })
        .expect(404);

      expect(response.body).toEqual({
        error: "Room NOTFOUND not found",
      });
    });

    it("should return 403 in production", async () => {
      process.env.NODE_ENV = "production";

      const response = await request(app)
        .post("/api/dev/seed-state")
        .send({
          gameCode: "ABCDEF",
          state: validState,
        })
        .expect(403);

      expect(response.body).toEqual({
        error: "Dev endpoints are not available in production",
      });

      process.env.NODE_ENV = "test";
    });

    it("should handle errors gracefully", async () => {
      mockRoom.setGameState.mockImplementation(() => {
        throw new Error("Test error");
      });

      const response = await request(app)
        .post("/api/dev/seed-state")
        .send({
          gameCode: "ABCDEF",
          state: validState,
        })
        .expect(500);

      expect(response.body.error).toBe("Failed to seed game state");
      expect(response.body.details).toBe("Test error");
    });
  });

  describe("GET /api/dev/room/:gameCode", () => {
    it("should return room state for existing room", async () => {
      const response = await request(app)
        .get("/api/dev/room/ABCDEF")
        .expect(200);

      expect(response.body).toEqual({
        gameCode: "ABCDEF",
        phase: "playing",
        gameState: null,
        players: [],
      });
      expect(mockRoom.getRoomState).toHaveBeenCalled();
    });

    it("should return 404 for non-existent room", async () => {
      const response = await request(app)
        .get("/api/dev/room/NOTFOUND")
        .expect(404);

      expect(response.body).toEqual({
        error: "Room NOTFOUND not found",
      });
    });

    it("should return 403 in production", async () => {
      process.env.NODE_ENV = "production";

      const response = await request(app)
        .get("/api/dev/room/ABCDEF")
        .expect(403);

      expect(response.body).toEqual({
        error: "Dev endpoints are not available in production",
      });

      process.env.NODE_ENV = "test";
    });
  });

  describe("POST /api/dev/reset-db", () => {
    it("should reset the database", async () => {
      const response = await request(app)
        .post("/api/dev/reset-db")
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Database reset successfully",
      });
      expect(dbService.resetDatabase).toHaveBeenCalled();
    });

    it("should return 403 in production", async () => {
      process.env.NODE_ENV = "production";

      const response = await request(app)
        .post("/api/dev/reset-db")
        .expect(403);

      expect(response.body).toEqual({
        error: "Dev endpoints are not available in production",
      });

      process.env.NODE_ENV = "test";
    });

    it("should handle errors gracefully", async () => {
      vi.spyOn(dbService, "resetDatabase").mockImplementation(() => {
        throw new Error("Database error");
      });

      const response = await request(app)
        .post("/api/dev/reset-db")
        .expect(500);

      expect(response.body.error).toBe("Failed to reset database");
      expect(response.body.details).toBe("Database error");
    });
  });
});
