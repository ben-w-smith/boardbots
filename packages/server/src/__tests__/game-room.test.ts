import { describe, it, expect, beforeEach } from "vitest";
import { GameRoom } from "../game-room.js";

// Mock storage that implements the DurableObjectStorage interface
function createMockStorage() {
  const store = new Map<string, unknown>();
  return {
    get: async <T>(key: string): Promise<T | undefined> => {
      return store.get(key) as T | undefined;
    },
    put: async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    },
    delete: async () => false,
    list: async () => new Map(),
    getAlarm: async () => null,
    setAlarm: async () => {},
    deleteAlarm: async () => {},
    transaction: async () => {},
    _store: store,
  } as unknown as DurableObjectStorage;
}

// Mock Durable Object State
function createMockState() {
  const webSockets = new Set<WebSocket>();
  const storage = createMockStorage();

  return {
    storage,
    webSockets,
    acceptWebSocket: (ws: WebSocket) => {
      webSockets.add(ws);
    },
    setWebSocketAutoResponse: () => {},
    getWebSockets: () => Array.from(webSockets),
  } as unknown as DurableObjectState;
}

// Create a mock WebSocket
function createMockWebSocket(): WebSocket & { _messages: string[] } {
  const messages: string[] = [];
  let attachment: unknown = null;

  const ws = {
    readyState: 1, // WebSocket.OPEN
    binaryType: "arraybuffer" as BinaryType,
    bufferedAmount: 0,
    extensions: "",
    protocol: "",
    url: "",
    onclose: null,
    onerror: null,
    onmessage: null,
    onopen: null,
    send: (data: string | ArrayBuffer | Blob | ArrayBufferView) => {
      if (typeof data === "string") {
        messages.push(data);
      }
    },
    close: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    serializeAttachment: (data: unknown) => {
      attachment = data;
    },
    deserializeAttachment: () => attachment,
    _messages: messages,
  } as unknown as WebSocket & { _messages: string[] };

  return ws;
}

describe("GameRoom", () => {
  let gameRoom: GameRoom;
  let mockState: DurableObjectState & { webSockets: Set<WebSocket> };

  beforeEach(() => {
    mockState = createMockState() as DurableObjectState & {
      webSockets: Set<WebSocket>;
    };
    gameRoom = new GameRoom(mockState);
  });

  // Helper: simulate the full lifecycle (fetch accepts ws, then send message)
  function acceptWs(ws: WebSocket) {
    mockState.acceptWebSocket(ws);
  }

  describe("fetch", () => {
    it("rejects non-websocket requests", async () => {
      const request = new Request("http://localhost/api/game/test", {
        method: "GET",
      });
      const response = await gameRoom.fetch(request);
      expect(response.status).toBe(426); // Upgrade Required
    });
  });

  describe("player management", () => {
    it("allows first player to join", async () => {
      const ws = createMockWebSocket();
      acceptWs(ws);

      // Simulate join message
      await gameRoom.webSocketMessage(
        ws,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );

      // Check that a gameState message was sent
      expect(ws._messages.length).toBeGreaterThan(0);

      const lastMessage = JSON.parse(ws._messages[ws._messages.length - 1]);
      expect(lastMessage.type).toBe("gameState");
      expect(lastMessage.players).toContain("Alice");
    });

    it("allows second player to join", async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      acceptWs(ws1);
      acceptWs(ws2);

      await gameRoom.webSocketMessage(
        ws1,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await gameRoom.webSocketMessage(
        ws2,
        JSON.stringify({ type: "join", playerName: "Bob" }),
      );

      const stateMessage = ws2._messages.find((m) => {
        const parsed = JSON.parse(m);
        return parsed.type === "gameState" && parsed.players.length === 2;
      });

      expect(stateMessage).toBeDefined();
      const parsed = JSON.parse(stateMessage!);
      expect(parsed.players).toEqual(["Alice", "Bob"]);
    });

    it("rejects third player as spectator", async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const ws3 = createMockWebSocket();
      acceptWs(ws1);
      acceptWs(ws2);
      acceptWs(ws3);

      await gameRoom.webSocketMessage(
        ws1,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await gameRoom.webSocketMessage(
        ws2,
        JSON.stringify({ type: "join", playerName: "Bob" }),
      );
      await gameRoom.webSocketMessage(
        ws3,
        JSON.stringify({ type: "join", playerName: "Charlie" }),
      );

      const errorMessage = ws3._messages.find((m) => {
        const parsed = JSON.parse(m);
        return parsed.type === "error" && parsed.message.includes("spectator");
      });

      expect(errorMessage).toBeDefined();
    });
  });

  describe("game flow", () => {
    it("starts game when host requests", async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      acceptWs(ws1);
      acceptWs(ws2);

      await gameRoom.webSocketMessage(
        ws1,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await gameRoom.webSocketMessage(
        ws2,
        JSON.stringify({ type: "join", playerName: "Bob" }),
      );
      await gameRoom.webSocketMessage(
        ws1,
        JSON.stringify({ type: "startGame" }),
      );

      const stateMessage = ws1._messages.find((m) => {
        const parsed = JSON.parse(m);
        return parsed.phase === "playing";
      });

      expect(stateMessage).toBeDefined();
    });

    it("rejects start from non-host", async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      acceptWs(ws1);
      acceptWs(ws2);

      await gameRoom.webSocketMessage(
        ws1,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await gameRoom.webSocketMessage(
        ws2,
        JSON.stringify({ type: "join", playerName: "Bob" }),
      );
      await gameRoom.webSocketMessage(
        ws2,
        JSON.stringify({ type: "startGame" }),
      );

      const errorMessage = ws2._messages.find((m) => {
        const parsed = JSON.parse(m);
        return parsed.type === "error" && parsed.message.includes("host");
      });

      expect(errorMessage).toBeDefined();
    });

    it("rejects moves before game starts", async () => {
      const ws = createMockWebSocket();
      acceptWs(ws);

      await gameRoom.webSocketMessage(
        ws,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await gameRoom.webSocketMessage(
        ws,
        JSON.stringify({
          type: "move",
          move: {
            type: "place",
            player: 0,
            position: { q: 0, r: 5 },
            direction: { q: 0, r: -1 },
          },
        }),
      );

      const errorMessage = ws._messages.find((m) => {
        const parsed = JSON.parse(m);
        return parsed.type === "error";
      });

      expect(errorMessage).toBeDefined();
    });
  });

  describe("reconnection", () => {
    it("allows player to reconnect", async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      acceptWs(ws1);

      await gameRoom.webSocketMessage(
        ws1,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await gameRoom.webSocketClose(ws1);

      // Simulate new WebSocket for reconnect
      acceptWs(ws2);
      await gameRoom.webSocketMessage(
        ws2,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );

      const joinMessage = ws2._messages.find((m) => {
        const parsed = JSON.parse(m);
        return parsed.type === "playerJoined" && parsed.name === "Alice";
      });

      expect(joinMessage).toBeDefined();
    });
  });

  describe("AI moves", () => {
    it("rejects AI move before game starts", async () => {
      const ws = createMockWebSocket();
      acceptWs(ws);

      await gameRoom.webSocketMessage(
        ws,
        JSON.stringify({ type: "join", playerName: "Alice" }),
      );
      await gameRoom.webSocketMessage(
        ws,
        JSON.stringify({ type: "requestAI" }),
      );

      const errorMessage = ws._messages.find((m) => {
        const parsed = JSON.parse(m);
        return (
          parsed.type === "error" && parsed.message.includes("not in progress")
        );
      });

      expect(errorMessage).toBeDefined();
    });
  });
});
