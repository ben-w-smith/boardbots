import type { WebSocket } from "ws";
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
import { dbService, type GameRecord } from "./db.js";
import type { JwtPayload } from "./auth/index.js";

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
  userId: number | null;
  winnerId: number | null;
  aiEnabled: boolean;
  aiDepth: number;
  aiPlayerIndex?: number;
}

// Client -> Server messages
type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "move"; move: GameMove }
  | { type: "startGame" }
  | { type: "startAIGame"; aiDepth: number }
  | { type: "rematch" }
  | { type: "resign" }
  | { type: "requestAI" }
  | { type: "ping" };

// Server -> Client messages
type ServerMessage =
  | {
      type: "gameState";
      state: TransportState | null;
      players: string[];
      phase: string;
      aiEnabled?: boolean;
      aiPlayerIndex?: number;
    }
  | { type: "error"; message: string }
  | { type: "playerJoined"; name: string; index: number }
  | { type: "playerLeft"; name: string }
  | { type: "gameOver"; winner: number; winnerName: string }
  | { type: "pong" };

// WebSocket attachment for player info
interface WSAttachment {
  playerName: string;
  playerIndex: number;
  isSpectator: boolean;
  user?: JwtPayload | null;
  // Rate limiting
  messageTimestamps: number[];
}

export class GameRoom {
  private gameCode: string;
  private persisted: PersistedGame;
  private sessions: Map<WebSocket, WSAttachment> = new Map();
  private loaded = false;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAIMove: ReturnType<typeof setTimeout> | null = null;
  private onEmpty?: (gameCode: string) => void;

  constructor(gameCode: string, onEmpty?: (gameCode: string) => void) {
    this.gameCode = gameCode;
    this.onEmpty = onEmpty;
    // Initialize with default state
    this.persisted = {
      gameState: null,
      players: new Map(),
      phase: "waiting",
      createdAt: Date.now(),
      hostName: null,
      userId: null,
      winnerId: null,
      aiEnabled: false,
      aiDepth: 3,
      aiPlayerIndex: undefined,
    };
  }

  // Called when a new WebSocket connection is established
  public async handleConnection(ws: WebSocket, user?: JwtPayload | null): Promise<void> {
    await this.ensureLoaded();

    // Store user info on WebSocket for later use
    if (user) {
      (ws as any).user = user;
    }

    ws.on("message", async (data) => {
      try {
        const message = data.toString();
        await this.handleMessage(ws, message);
      } catch (err) {
        console.error("Error handling message:", err);
      }
    });

    ws.on("close", () => {
      this.handleClose(ws);
    });

    // Send current game state to the new connection immediately
    this.sendTo(ws, this.buildGameStateMessage());
  }

  // Rate limiting constants
  private static readonly RATE_LIMIT_WINDOW_MS = 1000; // 1 second
  private static readonly RATE_LIMIT_MAX_MESSAGES = 20; // Max 20 messages per second

  private isRateLimited(ws: WebSocket): boolean {
    const attachment = this.sessions.get(ws);
    if (!attachment) return true;

    const now = Date.now();
    const timestamps = attachment.messageTimestamps;

    // Remove timestamps older than the window
    while (timestamps.length > 0 && timestamps[0] < now - GameRoom.RATE_LIMIT_WINDOW_MS) {
      timestamps.shift();
    }

    // Check if rate limited
    if (timestamps.length >= GameRoom.RATE_LIMIT_MAX_MESSAGES) {
      return true;
    }

    // Add current timestamp
    timestamps.push(now);
    return false;
  }

  private async handleMessage(ws: WebSocket, message: string): Promise<void> {
    // Rate limiting check
    if (this.isRateLimited(ws)) {
      this.sendTo(ws, { type: "error", message: "Too many messages. Please slow down." });
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
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
      case "startAIGame":
        await this.handleStartAIGame(ws, msg.aiDepth);
        break;
      case "rematch":
        await this.handleRematch(ws);
        break;
      case "resign":
        await this.handleResign(ws);
        break;
      case "requestAI":
        await this.handleRequestAI(ws);
        break;
      case "ping":
        this.sendTo(ws, { type: "pong" });
        break;
      default:
        this.sendTo(ws, { type: "error", message: "Unknown message type" });
    }
  }

  private handleClose(ws: WebSocket): void {
    const attachment = this.sessions.get(ws);
    if (attachment) {
      this.sessions.delete(ws);

      const player = this.persisted.players.get(attachment.playerName);
      if (player) {
        player.connected = false;
        this.saveState();
        this.broadcast({ type: "playerLeft", name: attachment.playerName });
      }

      if (this.sessions.size === 0) {
        this.startCleanupTimer();
      }
    }
  }

  private startCleanupTimer(): void {
    this.stopCleanupTimer();
    this.cleanupTimer = setTimeout(
      () => {
        this.onEmpty?.(this.gameCode);
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private async handleJoin(ws: WebSocket, playerName: string): Promise<void> {
    this.stopCleanupTimer();
    const existingPlayer = this.persisted.players.get(playerName);
    if (existingPlayer) {
      existingPlayer.connected = true;
      const user = (ws as any).user;
      this.sessions.set(ws, {
        playerName,
        playerIndex: existingPlayer.index,
        isSpectator: false,
        user: user || null,
        messageTimestamps: [],
      });

      this.saveState();
      // Don't broadcast playerJoined for reconnections - only for new players
      // This prevents UI cycling of "joined the game" messages
      this.broadcastGameState();
      return;
    }

    const playerCount = Array.from(this.persisted.players.values()).filter(
      (p) => p.index < 2,
    ).length;

    if (playerCount >= 2) {
      const user = (ws as any).user;
      this.sessions.set(ws, {
        playerName,
        playerIndex: -1,
        isSpectator: true,
        user: user || null,
        messageTimestamps: [],
      });

      this.sendTo(ws, {
        type: "error",
        message: "Game is full, joined as spectator",
      });
      // Send game state without user (spectators don't need special handling)
      this.sendTo(ws, this.buildGameStateMessage());
      return;
    }

    const playerIndex = playerCount;
    this.persisted.players.set(playerName, {
      name: playerName,
      index: playerIndex,
      connected: true,
    });

    // Associate game with authenticated user if this is the first player
    if (playerIndex === 0) {
      this.persisted.hostName = playerName;
      const user = (ws as any).user;
      if (user) {
        this.persisted.userId = user.userId;
      }
    }

    const user = (ws as any).user;
    this.sessions.set(ws, {
      playerName,
      playerIndex,
      isSpectator: false,
      user: user || null,
      messageTimestamps: [],
    });

    this.saveState();

    this.broadcast({
      type: "playerJoined",
      name: playerName,
      index: playerIndex,
    });
    this.broadcastGameState();
  }

  private async handleStartGame(ws: WebSocket): Promise<void> {
    const attachment = this.sessions.get(ws);
    if (!attachment || attachment.isSpectator) {
      this.sendTo(ws, {
        type: "error",
        message: "Only players can start the game",
      });
      return;
    }

    if (this.persisted.hostName !== attachment.playerName) {
      this.sendTo(ws, {
        type: "error",
        message: "Only the host can start the game",
      });
      return;
    }

    const connectedPlayers = Array.from(this.persisted.players.values()).filter(
      (p) => p.index < 2 && p.connected,
    );

    if (connectedPlayers.length < 2) {
      this.sendTo(ws, { type: "error", message: "Need 2 players to start" });
      return;
    }

    this.persisted.gameState = createGame(DEFAULT_GAME_DEF);
    this.persisted.phase = "playing";

    this.saveState();
    this.broadcastGameState();
  }

  private async handleStartAIGame(ws: WebSocket, aiDepth: number): Promise<void> {
    console.log(`[AI Game] handleStartAIGame called, aiDepth=${aiDepth}`);
    const attachment = this.sessions.get(ws);
    console.log(`[AI Game] attachment:`, attachment ? { playerName: attachment.playerName, isSpectator: attachment.isSpectator } : null);
    console.log(`[AI Game] hostName: ${this.persisted.hostName}`);

    if (!attachment || attachment.isSpectator) {
      console.log(`[AI Game] Rejected: not a player`);
      this.sendTo(ws, {
        type: "error",
        message: "Only players can start the game",
      });
      return;
    }

    if (this.persisted.hostName !== attachment.playerName) {
      console.log(`[AI Game] Rejected: not the host`);
      this.sendTo(ws, {
        type: "error",
        message: "Only the host can start the game",
      });
      return;
    }

    // Validate AI depth
    const validDepths = [2, 3, 4];
    if (!validDepths.includes(aiDepth)) {
      this.sendTo(ws, {
        type: "error",
        message: "Invalid AI depth. Must be 2 (Easy), 3 (Medium), or 4 (Hard)",
      });
      return;
    }

    // Need at least 1 human player
    const humanPlayers = Array.from(this.persisted.players.values()).filter(
      (p) => p.index < 1 && p.connected,
    );

    if (humanPlayers.length < 1) {
      this.sendTo(ws, { type: "error", message: "Need at least 1 human player" });
      return;
    }

    // Set up AI game
    this.persisted.aiEnabled = true;
    this.persisted.aiDepth = aiDepth;
    this.persisted.aiPlayerIndex = 1; // AI is player 1

    // Add AI player to the game
    this.persisted.players.set("AI", {
      name: "AI",
      index: 1,
      connected: true, // AI is always "connected"
    });

    this.persisted.gameState = createGame(DEFAULT_GAME_DEF);
    this.persisted.phase = "playing";

    this.saveState();
    this.broadcastGameState();

    // Trigger AI move if it's AI's turn first
    await this.maybeTriggerAIMove();
  }

  private async handleMove(ws: WebSocket, move: GameMove): Promise<void> {
    if (this.persisted.phase !== "playing" || !this.persisted.gameState) {
      this.sendTo(ws, { type: "error", message: "Game not in progress" });
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

    if (
      move.player !== attachment.playerIndex ||
      move.player !== this.persisted.gameState.playerTurn
    ) {
      this.sendTo(ws, { type: "error", message: "Not your turn" });
      return;
    }

    try {
      this.persisted.gameState = applyMove(this.persisted.gameState, move);
      if (!(await this.checkAndHandleGameOver())) {
        this.saveState();
        this.broadcastGameState();
        // Trigger AI move if it's AI's turn
        await this.maybeTriggerAIMove();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Invalid move";
      this.sendTo(ws, { type: "error", message: errorMessage });
    }
  }

  private async handleRequestAI(ws: WebSocket): Promise<void> {
    if (this.persisted.phase !== "playing" || !this.persisted.gameState) {
      this.sendTo(ws, { type: "error", message: "Game not in progress" });
      return;
    }

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
      if (!(await this.checkAndHandleGameOver())) {
        this.saveState();
        this.broadcastGameState();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "AI move failed";
      this.sendTo(ws, { type: "error", message: errorMessage });
    }
  }

  private async handleRematch(ws: WebSocket): Promise<void> {
    const attachment = this.sessions.get(ws);
    if (!attachment || attachment.isSpectator) {
      this.sendTo(ws, {
        type: "error",
        message: "Only players can request rematch",
      });
      return;
    }

    this.persisted.gameState = null;
    this.persisted.phase = "waiting";

    // Keep AI settings for rematch
    // Don't reset aiEnabled, aiDepth, aiPlayerIndex

    this.saveState();
    this.broadcastGameState();
  }

  private async handleResign(ws: WebSocket): Promise<void> {
    if (this.persisted.phase !== "playing" || !this.persisted.gameState) {
      this.sendTo(ws, { type: "error", message: "Game not in progress" });
      return;
    }

    const attachment = this.sessions.get(ws);
    if (!attachment || attachment.isSpectator) {
      this.sendTo(ws, {
        type: "error",
        message: "Only players can resign",
      });
      return;
    }

    // The resigning player loses - opponent wins
    const resigningPlayer = attachment.playerIndex;
    const winnerIndex = resigningPlayer === 0 ? 1 : 0;

    this.persisted.phase = "finished";
    const winnerPlayer = Array.from(this.persisted.players.values()).find(
      (p) => p.index === winnerIndex,
    );
    const winnerName = winnerPlayer?.name ?? "Unknown";

    // Find the WebSocket for the winner and get their userId
    const winnerSession = Array.from(this.sessions.entries()).find(
      ([, att]) => att.playerName === winnerName && att.user,
    );

    if (winnerSession && winnerSession[1].user) {
      this.persisted.winnerId = winnerSession[1].user.userId;
      dbService.updateGameWinner(this.gameCode, winnerSession[1].user.userId);
    }

    this.saveState();
    this.broadcastGameState();
    this.broadcast({ type: "gameOver", winner: winnerIndex, winnerName });
  }

  /**
   * Trigger AI move if it's AI's turn.
   * Handles race conditions and timeout gracefully.
   */
  private async maybeTriggerAIMove(): Promise<void> {
    // Cancel any pending AI move
    if (this.pendingAIMove) {
      clearTimeout(this.pendingAIMove);
      this.pendingAIMove = null;
    }

    if (
      this.persisted.phase !== "playing" ||
      !this.persisted.gameState ||
      !this.persisted.aiEnabled
    ) {
      return;
    }

    const currentTurn = this.persisted.gameState.playerTurn;
    const aiPlayerIndex = this.persisted.aiPlayerIndex ?? 1;

    if (currentTurn !== aiPlayerIndex) {
      return;
    }

    // Schedule AI move with a small delay for realism
    this.pendingAIMove = setTimeout(async () => {
      // Double-check state hasn't changed during timeout
      if (
        this.persisted.phase !== "playing" ||
        !this.persisted.gameState ||
        this.persisted.gameState.playerTurn !== aiPlayerIndex ||
        !this.persisted.aiEnabled
      ) {
        this.pendingAIMove = null;
        return;
      }

      const startTime = Date.now();
      const timeoutMs = 1000; // 1 second timeout

      const result = findBestMove(
        this.persisted.gameState,
        aiPlayerIndex,
        this.persisted.aiDepth,
        timeoutMs,
      );

      const elapsed = Date.now() - startTime;
      console.log(`AI move took ${elapsed}ms (depth: ${this.persisted.aiDepth})`);

      if (!result.move) {
        console.warn("AI could not find a valid move, passing turn");
        // AI couldn't find a move - game might be stuck
        // For now, we'll pass and let the game continue
        this.pendingAIMove = null;
        return;
      }

      try {
        this.persisted.gameState = applyMove(this.persisted.gameState, result.move);

        if (!(await this.checkAndHandleGameOver())) {
          this.saveState();
          this.broadcastGameState();

          // Check if AI gets another turn (multi-action turn)
          if (this.persisted.gameState!.playerTurn === aiPlayerIndex) {
            await this.maybeTriggerAIMove();
          }
        }
      } catch (err) {
        console.error("AI move failed:", err);
      }

      this.pendingAIMove = null;
    }, 500); // 500ms thinking time for realism
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const record = dbService.getGame(this.gameCode);
    if (record) {
      this.persisted = {
        gameState: record.state ? JSON.parse(record.state) : null,
        players: new Map(Object.entries(JSON.parse(record.players))),
        phase: record.phase as any,
        createdAt: record.createdAt,
        hostName: record.hostName,
        userId: record.userId ?? null,
        winnerId: record.winnerId ?? null,
        aiEnabled: record.aiEnabled ?? false,
        aiDepth: record.aiDepth ?? 3,
        aiPlayerIndex: record.aiPlayerIndex,
      };
    }
    this.loaded = true;
  }

  /** Note: better-sqlite3 is synchronous, but we keep the method name consistent. */
  private saveState(): void {
    dbService.saveGame({
      gameCode: this.gameCode,
      state: this.persisted.gameState
        ? JSON.stringify(this.persisted.gameState)
        : "",
      players: JSON.stringify(Object.fromEntries(this.persisted.players)),
      phase: this.persisted.phase,
      createdAt: this.persisted.createdAt,
      hostName: this.persisted.hostName,
      userId: this.persisted.userId,
      winnerId: this.persisted.winnerId,
      aiEnabled: this.persisted.aiEnabled,
      aiDepth: this.persisted.aiDepth,
      aiPlayerIndex: this.persisted.aiPlayerIndex,
    });
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of Array.from(this.sessions.keys())) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(data);
      }
    }
  }

  private buildGameStateMessage(): ServerMessage {
    const playerNames = Array.from(this.persisted.players.values())
      .filter((p) => p.index < 2)
      .sort((a, b) => a.index - b.index)
      .map((p) => p.name);

    return {
      type: "gameState",
      state: this.persisted.gameState
        ? toTransport(this.persisted.gameState)
        : null,
      players: playerNames,
      phase: this.persisted.phase,
      aiEnabled: this.persisted.aiEnabled,
      aiPlayerIndex: this.persisted.aiPlayerIndex,
    };
  }

  private broadcastGameState(): void {
    this.broadcast(this.buildGameStateMessage());
  }

  private async checkAndHandleGameOver(): Promise<boolean> {
    if (!this.persisted.gameState) return false;

    const { isOver, winner } = checkGameOver(this.persisted.gameState);
    if (isOver) {
      this.persisted.phase = "finished";
      const winnerPlayer = Array.from(this.persisted.players.values()).find(
        (p) => p.index === winner,
      );
      const winnerName = winnerPlayer?.name ?? "Unknown";

      // Find the WebSocket for the winner and get their userId
      const winnerSession = Array.from(this.sessions.entries()).find(
        ([, attachment]) => attachment.playerName === winnerName && attachment.user,
      );

      if (winnerSession && winnerSession[1].user) {
        this.persisted.winnerId = winnerSession[1].user.userId;
        // Update the game record with the winner
        dbService.updateGameWinner(this.gameCode, winnerSession[1].user.userId);
      }

      this.saveState();
      this.broadcastGameState();
      this.broadcast({ type: "gameOver", winner, winnerName });
      return true;
    }
    return false;
  }

}
