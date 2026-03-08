# BoardBots Server - AI Agent Guide

This document covers critical patterns and gotchas for AI agents working on the BoardBots Node.js server.

---

## Architecture Overview

The server is a Node.js application using:
- **Express** - HTTP server with CORS
- **ws** - WebSocket server for real-time game communication
- **better-sqlite3** - Persistent SQLite storage for game rooms

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server entry — Express routes, WebSocket upgrade, static file serving |
| `src/RoomManager.ts` | Singleton manager for game rooms, WebSocket routing |
| `src/game-room.ts` | `GameRoom` class — WebSocket handler, game state, multiplayer logic |
| `src/db.ts` | SQLite database initialization and queries |

---

## WebSocket Flow

1. Client connects via WebSocket to `/api/game/{CODE}`
2. Server routes connection to appropriate `GameRoom` via `RoomManager`
3. First message from client is `{type: 'join', playerName}`
4. Server broadcasts `playerJoined` and `gameState` to all clients in room

---

## Game Flow

1. **Create Lobby**: Player calls `POST /api/lobby/create` → gets 6-char game code
2. **Connect**: Both players connect via WebSocket to `/api/game/{CODE}`
3. **Join**: Each client sends `{type: 'join', playerName}` → server broadcasts `playerJoined` and `gameState`
4. **Start**: Host sends `{type: 'startGame'}` → server initializes game, broadcasts state with `phase: 'playing'`
5. **Play**: Client sends `{type: 'move', move}` → server validates via `applyMove()` → broadcasts new state
6. **Win**: When a player has <= 2 robots remaining → server broadcasts `gameOver`

---

## RoomManager Pattern

The `RoomManager` is a singleton that manages all active game rooms:

```typescript
// Get the singleton instance
const manager = RoomManager.getInstance();

// Handle a new WebSocket connection
manager.handleConnection(gameCode, ws);
```

Rooms are created on-demand when a player connects and stored in memory with SQLite backup.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server listening port |
| `NODE_ENV` | development | Environment mode |
| `DATABASE_PATH` | ./boardbots.db | SQLite database file path |

---

## Local Development

```bash
# Start server with hot reload
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Start production build
npm start
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (returns "OK") |
| POST | `/api/lobby/create` | Create new lobby (returns `{gameCode}`) |
| WS | `/api/game/{CODE}` | WebSocket connection for game room |
| GET | `*` | Serves SPA (client static files) |

---

## Testing Gotchas

- Tests use Vitest with mocked WebSocket connections
- Mock RoomManager state between tests to avoid cross-test contamination
- Use `beforeEach` to reset singleton state if needed

---

## Quick Reference: Do's and Don'ts

| Do | Don't |
|----|-------|
| Use `RoomManager.getInstance()` for room access | Create multiple RoomManager instances |
| Broadcast via `room.broadcast()` | Manually iterate WebSocket connections |
| Store game state in `GameRoom` class | Store state in global variables |
| Handle WebSocket close events | Assume connections stay open forever |
