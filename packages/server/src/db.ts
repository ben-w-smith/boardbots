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
  CREATE TABLE IF NOT EXISTS games (
    gameCode TEXT PRIMARY KEY,
    state TEXT,  -- JSON string of GameState
    players TEXT, -- JSON string of Map entries
    phase TEXT,
    createdAt INTEGER,
    hostName TEXT
  );
`);

export interface GameRecord {
  gameCode: string;
  state: string;
  players: string;
  phase: string;
  createdAt: number;
  hostName: string | null;
}

export const dbService = {
  saveGame(game: GameRecord) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO games (gameCode, state, players, phase, createdAt, hostName)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      game.gameCode,
      game.state,
      game.players,
      game.phase,
      game.createdAt,
      game.hostName,
    );
  },

  getGame(gameCode: string): GameRecord | null {
    const stmt = db.prepare("SELECT * FROM games WHERE gameCode = ?");
    return stmt.get(gameCode) as GameRecord | null;
  },
};
