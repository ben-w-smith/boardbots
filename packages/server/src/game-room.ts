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

export class GameRoom {
  private gameCode: string;
  private persisted: PersistedGame;
  private sessions: Map<WebSocket, WSAttachment> = new Map();
  private loaded = false;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
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
    };
  }

  // Called when a new WebSocket connection is established
  public async handleConnection(ws: WebSocket): Promise<void> {
    await this.ensureLoaded();

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
    this.sendGameState(ws);
  }

  private async handleMessage(ws: WebSocket, message: string): Promise<void> {
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
      this.sessions.set(ws, {
        playerName,
        playerIndex: existingPlayer.index,
        isSpectator: false,
      });

      this.saveState();
      this.broadcast({
        type: "playerJoined",
        name: playerName,
        index: existingPlayer.index,
      });
      this.broadcastGameState();
      return;
    }

    const playerCount = Array.from(this.persisted.players.values()).filter(
      (p) => p.index < 2,
    ).length;

    if (playerCount >= 2) {
      this.sessions.set(ws, {
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

    const playerIndex = playerCount;
    this.persisted.players.set(playerName, {
      name: playerName,
      index: playerIndex,
      connected: true,
    });

    if (playerIndex === 0) {
      this.persisted.hostName = playerName;
    }

    this.sessions.set(ws, {
      playerName,
      playerIndex,
      isSpectator: false,
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

    this.saveState();
    this.broadcastGameState();
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
      const winnerName =
        Array.from(this.persisted.players.values()).find(
          (p) => p.index === winner,
        )?.name ?? "Unknown";

      this.saveState();
      this.broadcastGameState();
      this.broadcast({ type: "gameOver", winner, winnerName });
      return true;
    }
    return false;
  }

  private sendGameState(ws: WebSocket): void {
    this.sendTo(ws, this.buildGameStateMessage());
  }
}
