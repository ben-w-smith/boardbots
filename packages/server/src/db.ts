import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, we'll want a persistent path (e.g., /app/data/boardbots.db)
// This can be overridden by an environment variable.
const DB_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, "../boardbots.db");

// Ensure the directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    createdAt INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    gameCode TEXT PRIMARY KEY,
    state TEXT,  -- JSON string of GameState
    players TEXT, -- JSON string of Map entries
    phase TEXT,
    createdAt INTEGER,
    hostName TEXT,
    userId INTEGER,
    winnerId INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (winnerId) REFERENCES users(id)
  );
`);

// Add columns to existing games table if they don't exist (for migrations)
try {
  db.exec(`ALTER TABLE games ADD COLUMN userId INTEGER`);
} catch {}
try {
  db.exec(`ALTER TABLE games ADD COLUMN winnerId INTEGER`);
} catch {}
try {
  db.exec(`ALTER TABLE games ADD COLUMN aiEnabled INTEGER DEFAULT 0`);
} catch {}
try {
  db.exec(`ALTER TABLE games ADD COLUMN aiDepth INTEGER DEFAULT 3`);
} catch {}
try {
  db.exec(`ALTER TABLE games ADD COLUMN aiPlayerIndex INTEGER`);
} catch {}

export interface GameRecord {
  gameCode: string;
  state: string;
  players: string;
  phase: string;
  createdAt: number;
  hostName: string | null;
  userId: number | null;
  winnerId: number | null;
  aiEnabled?: boolean;
  aiDepth?: number;
  aiPlayerIndex?: number;
}

export interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  createdAt: number;
}

export interface UserStats {
  userId: number;
  username: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

export interface GameHistoryItem {
  gameCode: string;
  phase: string;
  players: string;
  createdAt: number;
  winnerId: number | null;
  aiEnabled: boolean;
}

export interface GameHistoryResponse {
  games: GameHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface GameDetailResponse {
  game: {
    gameCode: string;
    state: string | null;
    players: string;
    phase: string;
    createdAt: number;
    winnerId: number | null;
    aiEnabled: boolean;
    aiDepth: number;
    aiPlayerIndex: number | null;
  };
}

export const dbService = {
  // Game operations
  saveGame(game: GameRecord) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO games (gameCode, state, players, phase, createdAt, hostName, userId, winnerId, aiEnabled, aiDepth, aiPlayerIndex)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      game.gameCode,
      game.state,
      game.players,
      game.phase,
      game.createdAt,
      game.hostName,
      game.userId,
      game.winnerId,
      game.aiEnabled ? 1 : 0,
      game.aiDepth ?? 3,
      game.aiPlayerIndex ?? null,
    );
  },

  getGame(gameCode: string): GameRecord | null {
    const stmt = db.prepare("SELECT * FROM games WHERE gameCode = ?");
    return stmt.get(gameCode) as GameRecord | null;
  },

  // User operations
  createUser(username: string, passwordHash: string): UserRecord {
    // Normalize username to lowercase for case-insensitive matching
    const normalizedUsername = username.toLowerCase();
    const stmt = db.prepare(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)"
    );
    const result = stmt.run(normalizedUsername, passwordHash);
    return this.getUserById(result.lastInsertRowid as number)!;
  },

  getUserByUsername(username: string): UserRecord | null {
    // Normalize username to lowercase for case-insensitive matching
    const normalizedUsername = username.toLowerCase();
    const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
    return stmt.get(normalizedUsername) as UserRecord | null;
  },

  getUserById(id: number): UserRecord | null {
    const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(id) as UserRecord | null;
  },

  // User stats
  getUserStats(userId: number): UserStats | null {
    const user = this.getUserById(userId);
    if (!user) return null;

    const gamesPlayedStmt = db.prepare(
      "SELECT COUNT(*) as count FROM games WHERE userId = ?"
    );
    const gamesPlayed = (gamesPlayedStmt.get(userId) as { count: number })
      .count;

    const winsStmt = db.prepare(
      "SELECT COUNT(*) as count FROM games WHERE userId = ? AND winnerId = ?"
    );
    const wins = (winsStmt.get(userId, userId) as { count: number }).count;

    return {
      userId,
      username: user.username,
      gamesPlayed,
      wins,
      losses: gamesPlayed - wins,
    };
  },

  // Update game winner
  updateGameWinner(gameCode: string, winnerId: number): void {
    const stmt = db.prepare(
      "UPDATE games SET winnerId = ? WHERE gameCode = ?"
    );
    stmt.run(winnerId, gameCode);
  },

  // Get paginated games for a user (as host), ordered by createdAt desc
  getUserGames(userId: number, limit: number = 20, offset: number = 0): GameHistoryItem[] {
    const stmt = db.prepare(`
      SELECT gameCode, phase, players, createdAt, winnerId, aiEnabled
      FROM games
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(userId, limit, offset) as any[];
    return rows.map(row => ({
      gameCode: row.gameCode,
      phase: row.phase,
      players: row.players,
      createdAt: row.createdAt,
      winnerId: row.winnerId,
      aiEnabled: row.aiEnabled === 1,
    }));
  },

  // Get total count of games for a user (for pagination)
  getUserGamesCount(userId: number): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM games
      WHERE userId = ?
    `);
    const result = stmt.get(userId) as { total: number };
    return result.total;
  },

  // Get full game details for a specific game (only if owned by user)
  getUserGameDetail(userId: number, gameCode: string): GameRecord | null {
    const stmt = db.prepare(`
      SELECT * FROM games
      WHERE userId = ? AND gameCode = ?
    `);
    return stmt.get(userId, gameCode) as GameRecord | null;
  },
};
