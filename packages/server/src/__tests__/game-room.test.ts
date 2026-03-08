import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameRoom } from "../game-room.js";
import { EventEmitter } from "events";
import { createGame } from "@lockitdown/engine";

// Mock the db module
vi.mock("../db.js", () => ({
  dbService: {
    saveGame: vi.fn(),
    getGame: vi.fn().mockReturnValue(null),
  },
}));

// Mock WebSocket class
class MockWebSocket extends EventEmitter {
  public readyState = 1; // OPEN
  public _messages: string[] = [];

  send(data: string) {
    this._messages.push(data);
  }

  close() {
    this.emit("close");
  }
}

describe("GameRoom", () => {
  let gameRoom: GameRoom;

  beforeEach(() => {
    vi.clearAllMocks();
    gameRoom = new GameRoom("TEST69");
  });

  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
  }

  describe("player management", () => {
    it("allows first player to join", async () => {
      const ws = new MockWebSocket() as any;
      await gameRoom.handleConnection(ws);

      ws.emit("message", JSON.stringify({ type: "join", playerName: "Alice" }));
      await flushMicrotasks();

      const gameStateMsg = ws._messages.find((m: string) => {
        const parsed = JSON.parse(m);
        return parsed.type === "gameState" && parsed.players.includes("Alice");
      });
      expect(gameStateMsg).toBeDefined();
    });

    it("allows second player to join", async () => {
      const ws1 = new MockWebSocket() as any;
      const ws2 = new MockWebSocket() as any;

      await gameRoom.handleConnection(ws1);
      await gameRoom.handleConnection(ws2);

      ws1.emit(
        "message",
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      ws2.emit("message", JSON.stringify({ type: "join", playerName: "Bob" }));
      await flushMicrotasks();

      const stateMessage = ws2._messages.find((m: string) => {
        const parsed = JSON.parse(m);
        return (
          parsed.type === "gameState" &&
          parsed.players.length === 2 &&
          parsed.players.includes("Bob")
        );
      });

      expect(stateMessage).toBeDefined();
      const parsed = JSON.parse(stateMessage);
      expect(parsed.players).toEqual(["Alice", "Bob"]);
    });
  });

  describe("game flow", () => {
    it("starts game when host requests", async () => {
      const ws1 = new MockWebSocket() as any;
      const ws2 = new MockWebSocket() as any;

      await gameRoom.handleConnection(ws1);
      await gameRoom.handleConnection(ws2);

      ws1.emit(
        "message",
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      ws2.emit("message", JSON.stringify({ type: "join", playerName: "Bob" }));
      await flushMicrotasks();

      ws1.emit("message", JSON.stringify({ type: "startGame" }));
      await flushMicrotasks();

      const stateMessage = ws1._messages.find(
        (m: string) => JSON.parse(m).phase === "playing",
      );
      expect(stateMessage).toBeDefined();
    });

    it("rejects start from non-host", async () => {
      const ws1 = new MockWebSocket() as any;
      const ws2 = new MockWebSocket() as any;

      await gameRoom.handleConnection(ws1);
      await gameRoom.handleConnection(ws2);

      ws1.emit(
        "message",
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      ws2.emit("message", JSON.stringify({ type: "join", playerName: "Bob" }));
      await flushMicrotasks();

      ws2.emit("message", JSON.stringify({ type: "startGame" }));
      await flushMicrotasks();

      const errorMsg = ws2._messages.find(
        (m: string) =>
          JSON.parse(m).type === "error" &&
          JSON.parse(m).message.includes("host"),
      );
      expect(errorMsg).toBeDefined();
    });
  });

  describe("reconnection", () => {
    it("allows player to reconnect", async () => {
      const ws1 = new MockWebSocket() as any;
      await gameRoom.handleConnection(ws1);
      ws1.emit(
        "message",
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await flushMicrotasks();

      ws1.emit("close");
      await flushMicrotasks();

      const ws2 = new MockWebSocket() as any;
      await gameRoom.handleConnection(ws2);
      ws2.emit(
        "message",
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await flushMicrotasks();

      const joinMsg = ws2._messages.find(
        (m: string) =>
          JSON.parse(m).type === "playerJoined" &&
          JSON.parse(m).name === "Alice",
      );
      expect(joinMsg).toBeDefined();
    });
  });

  describe("cleanup", () => {
    it("calls onEmpty when last player leaves", async () => {
      vi.useFakeTimers();
      const onEmpty = vi.fn();
      gameRoom = new GameRoom("CLEANUP", onEmpty);

      const ws = new MockWebSocket() as any;
      await gameRoom.handleConnection(ws);
      ws.emit("message", JSON.stringify({ type: "join", playerName: "Alice" }));
      await vi.runAllTicks();

      ws.emit("close");
      await vi.runAllTicks();

      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(onEmpty).toHaveBeenCalledWith("CLEANUP");
      vi.useRealTimers();
    });
  });
});
