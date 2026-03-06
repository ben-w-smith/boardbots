import {
  createGame,
  applyMove,
  checkGameOver,
  toTransport,
  findBestMove,
  type GameState,
  type GameDef,
  type GameMove,
  type TransportState,
} from "@lockitdown/engine";

// Standard 2-player game definition
const DEFAULT_GAME_DEF: GameDef = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  robotsPerPlayer: 6,
  winCondition: "Elimination",
  movesPerTurn: 3,
};

// Persisted state schema
interface PersistedGame {
  gameState: GameState | null;
  players: Map<string, { name: string; index: number; connected: boolean }>;
  phase: "waiting" | "playing" | "finished";
  createdAt: number;
  hostName: string | null;
}

// Client -> Server messages
type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "move"; move: GameMove }
  | { type: "startGame" }
  | { type: "rematch" }
  | { type: "requestAI" };

// Server -> Client messages
type ServerMessage =
  | {
      type: "gameState";
      state: TransportState | null;
      players: string[];
      phase: string;
    }
  | { type: "error"; message: string }
  | { type: "playerJoined"; name: string; index: number }
  | { type: "playerLeft"; name: string }
  | { type: "gameOver"; winner: number; winnerName: string };

// WebSocket attachment for player info
interface WSAttachment {
  playerName: string;
  playerIndex: number;
  isSpectator: boolean;
}

export class GameRoom implements DurableObject {
  private state: DurableObjectState;
  private persisted: PersistedGame;
  private sessions: Map<WebSocket, WSAttachment> = new Map();
  private loaded = false;

  constructor(state: DurableObjectState) {
    this.state = state;
    // Initialize with default state (will be loaded from storage on first access)
    this.persisted = {
      gameState: null,
      players: new Map(),
      phase: "waiting",
      createdAt: Date.now(),
      hostName: null,
    };
  }

  async fetch(request: Request): Promise<Response> {
    // WebSocket upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket (using hibernation API)
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Called when WebSocket receives a message
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    await this.ensureLoaded();

    // Rebuild session for this ws from serialized attachment (survives hibernation)
    if (!this.sessions.has(ws)) {
      const attachment = ws.deserializeAttachment() as WSAttachment | undefined;
      if (attachment) {
        this.sessions.set(ws, attachment);
      }
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message as string) as ClientMessage;
    } catch {
      this.sendTo(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    switch (msg.type) {
      case "join":
        await this.handleJoin(ws, msg.playerName);
        break;
      case "move":
        await this.handleMove(ws, msg.move);
        break;
      case "startGame":
        await this.handleStartGame(ws);
        break;
      case "rematch":
        await this.handleRematch(ws);
        break;
      case "requestAI":
        await this.handleRequestAI(ws);
        break;
      default:
        this.sendTo(ws, { type: "error", message: "Unknown message type" });
    }
  }

  // Called when WebSocket closes
  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ensureLoaded();

    // Recover attachment from serialized data if not in sessions Map
    let attachment = this.sessions.get(ws);
    if (!attachment) {
      attachment = ws.deserializeAttachment() as WSAttachment | undefined;
    }

    if (attachment) {
      this.sessions.delete(ws);

      // Mark player as disconnected
      const player = this.persisted.players.get(attachment.playerName);
      if (player) {
        player.connected = false;
        await this.saveState();

        // Broadcast player left
        this.broadcast({ type: "playerLeft", name: attachment.playerName });
      }
    }
  }

  // Handle player joining
  private async handleJoin(ws: WebSocket, playerName: string): Promise<void> {
    // Check if this is a reconnect
    const existingPlayer = this.persisted.players.get(playerName);
    if (existingPlayer) {
      existingPlayer.connected = true;
      this.sessions.set(ws, {
        playerName,
        playerIndex: existingPlayer.index,
        isSpectator: false,
      });
      ws.serializeAttachment({
        playerName,
        playerIndex: existingPlayer.index,
        isSpectator: false,
      });

      await this.saveState();
      this.broadcast({
        type: "playerJoined",
        name: playerName,
        index: existingPlayer.index,
      });
      this.broadcastGameState();
      return;
    }

    // Check if game is full (max 2 players)
    const playerCount = Array.from(this.persisted.players.values()).filter(
      (p) => p.index < 2,
    ).length;

    if (playerCount >= 2) {
      // Accept as spectator
      this.sessions.set(ws, {
        playerName,
        playerIndex: -1,
        isSpectator: true,
      });
      ws.serializeAttachment({
        playerName,
        playerIndex: -1,
        isSpectator: true,
      });

      this.sendTo(ws, {
        type: "error",
        message: "Game is full, joined as spectator",
      });
      this.sendGameState(ws);
      return;
    }

    // Add new player
    const playerIndex = playerCount;
    this.persisted.players.set(playerName, {
      name: playerName,
      index: playerIndex,
      connected: true,
    });

    // First player is host
    if (playerIndex === 0) {
      this.persisted.hostName = playerName;
    }

    this.sessions.set(ws, {
      playerName,
      playerIndex,
      isSpectator: false,
    });
    ws.serializeAttachment({
      playerName,
      playerIndex,
      isSpectator: false,
    });

    await this.saveState();

    this.broadcast({
      type: "playerJoined",
      name: playerName,
      index: playerIndex,
    });
    this.broadcastGameState();
  }

  // Handle starting the game
  private async handleStartGame(ws: WebSocket): Promise<void> {
    const attachment = this.sessions.get(ws);
    if (!attachment || attachment.isSpectator) {
      this.sendTo(ws, {
        type: "error",
        message: "Only players can start the game",
      });
      return;
    }

    // Only host can start
    if (this.persisted.hostName !== attachment.playerName) {
      this.sendTo(ws, {
        type: "error",
        message: "Only the host can start the game",
      });
      return;
    }

    // Check if 2 players are connected
    const connectedPlayers = Array.from(this.persisted.players.values()).filter(
      (p) => p.index < 2 && p.connected,
    );

    if (connectedPlayers.length < 2) {
      this.sendTo(ws, { type: "error", message: "Need 2 players to start" });
      return;
    }

    // Create the game
    this.persisted.gameState = createGame(DEFAULT_GAME_DEF);
    this.persisted.phase = "playing";

    await this.saveState();
    this.broadcastGameState();
  }

  // Handle a move
  private async handleMove(ws: WebSocket, move: GameMove): Promise<void> {
    if (this.persisted.phase !== "playing") {
      this.sendTo(ws, { type: "error", message: "Game not in progress" });
      return;
    }

    if (!this.persisted.gameState) {
      this.sendTo(ws, { type: "error", message: "No game state" });
      return;
    }

    const attachment = this.sessions.get(ws);
    if (!attachment || attachment.isSpectator) {
      this.sendTo(ws, {
        type: "error",
        message: "Spectators cannot make moves",
      });
      return;
    }

    // Validate it's this player's turn
    if (move.player !== attachment.playerIndex) {
      this.sendTo(ws, { type: "error", message: "Not your turn" });
      return;
    }

    // Validate move.player matches current turn
    if (move.player !== this.persisted.gameState.playerTurn) {
      this.sendTo(ws, { type: "error", message: "Not your turn" });
      return;
    }

    try {
      this.persisted.gameState = applyMove(this.persisted.gameState, move);

      // Check for game over
      const { isOver, winner } = checkGameOver(this.persisted.gameState);
      if (isOver) {
        this.persisted.phase = "finished";
        const winnerName =
          Array.from(this.persisted.players.values()).find(
            (p) => p.index === winner,
          )?.name ?? "Unknown";

        await this.saveState();
        this.broadcastGameState();
        this.broadcast({ type: "gameOver", winner, winnerName });
        return;
      }

      await this.saveState();
      this.broadcastGameState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Invalid move";
      this.sendTo(ws, { type: "error", message: errorMessage });
    }
  }

  // Handle AI move request
  private async handleRequestAI(ws: WebSocket): Promise<void> {
    if (this.persisted.phase !== "playing") {
      this.sendTo(ws, { type: "error", message: "Game not in progress" });
      return;
    }

    if (!this.persisted.gameState) {
      this.sendTo(ws, { type: "error", message: "No game state" });
      return;
    }

    // Find the AI move
    const result = findBestMove(
      this.persisted.gameState,
      this.persisted.gameState.playerTurn,
      3,
    );

    if (!result.move) {
      this.sendTo(ws, { type: "error", message: "No valid moves available" });
      return;
    }

    try {
      this.persisted.gameState = applyMove(
        this.persisted.gameState,
        result.move,
      );

      // Check for game over
      const { isOver, winner } = checkGameOver(this.persisted.gameState);
      if (isOver) {
        this.persisted.phase = "finished";
        const winnerName =
          Array.from(this.persisted.players.values()).find(
            (p) => p.index === winner,
          )?.name ?? "Unknown";

        await this.saveState();
        this.broadcastGameState();
        this.broadcast({ type: "gameOver", winner, winnerName });
        return;
      }

      await this.saveState();
      this.broadcastGameState();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "AI move failed";
      this.sendTo(ws, { type: "error", message: errorMessage });
    }
  }

  // Handle rematch request
  private async handleRematch(ws: WebSocket): Promise<void> {
    const attachment = this.sessions.get(ws);
    if (!attachment || attachment.isSpectator) {
      this.sendTo(ws, {
        type: "error",
        message: "Only players can request rematch",
      });
      return;
    }

    // Reset the game
    this.persisted.gameState = null;
    this.persisted.phase = "waiting";

    await this.saveState();
    this.broadcastGameState();
  }

  // Load state from storage (only once per wake cycle)
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.loadState();
    this.loaded = true;
  }

  // Load state from storage
  private async loadState(): Promise<void> {
    const stored = await this.state.storage.get<PersistedGame>("gameState");
    if (stored) {
      // Convert players back to Map if needed
      if (stored.players instanceof Map) {
        this.persisted = stored;
      } else {
        // Handle case where Map was serialized as object
        type PlayerEntry = { name: string; index: number; connected: boolean };
        this.persisted = {
          ...stored,
          players: new Map(
            Object.entries(stored.players as Record<string, PlayerEntry>),
          ),
        };
      }
    }
  }

  // Save state to storage
  private async saveState(): Promise<void> {
    // Convert Map to object for storage
    const toStore = {
      ...this.persisted,
      players: Object.fromEntries(this.persisted.players),
    };
    await this.state.storage.put(
      "gameState",
      toStore as unknown as PersistedGame,
    );
  }

  // Send a message to a specific WebSocket
  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // WebSocket might be closed
    }
  }

  // Broadcast to all connected WebSockets
  // Uses this.state.getWebSockets() which survives DO hibernation,
  // unlike the in-memory sessions Map which is wiped on wake.
  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // WebSocket might be closed
      }
    }
  }

  // Broadcast game state to all
  private broadcastGameState(): void {
    const playerNames = Array.from(this.persisted.players.values())
      .filter((p) => p.index < 2)
      .sort((a, b) => a.index - b.index)
      .map((p) => p.name);

    const msg: ServerMessage = {
      type: "gameState",
      state: this.persisted.gameState
        ? toTransport(this.persisted.gameState)
        : null,
      players: playerNames,
      phase: this.persisted.phase,
    };

    this.broadcast(msg);
  }

  // Send game state to a specific client
  private sendGameState(ws: WebSocket): void {
    const playerNames = Array.from(this.persisted.players.values())
      .filter((p) => p.index < 2)
      .sort((a, b) => a.index - b.index)
      .map((p) => p.name);

    const msg: ServerMessage = {
      type: "gameState",
      state: this.persisted.gameState
        ? toTransport(this.persisted.gameState)
        : null,
      players: playerNames,
      phase: this.persisted.phase,
    };

    this.sendTo(ws, msg);
  }
}
