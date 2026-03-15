# BoardBots Architecture Overview

## System Architecture

```
+----------------+     WebSocket      +------------------+
|  Client (Vite) | <----------------> | Server (Node.js) |
|  - Canvas UI   |                    | - Express HTTP   |
|  - Game state  |                    | - ws WebSocket   |
+----------------+                    | - SQLite DB      |
         |                            +------------------+
         |                                    |
         v                                    v
+----------------------------------------------------+
|              Engine (pure logic)                   |
|  - Hex grid, moves, beam resolution, AI           |
+----------------------------------------------------+
```

## Monorepo Structure

```
packages/
  engine/   # Pure game logic (no I/O dependencies)
  client/   # Vite SPA (canvas renderer, WebSocket client)
  server/   # Node.js + Express (game rooms, WebSocket, SQLite)
```

## Package Dependencies

```
@lockitdown/engine    <-- No dependencies on client/server
      ^
      |
      +---- client (depends on @lockitdown/engine)
      |
      +---- @lockitdown/server (depends on @lockitdown/engine)
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Build | Vite 7.x | Client bundling, HMR |
| Runtime (Server) | Node.js + Express 4.x | HTTP server, API |
| Realtime | ws | WebSocket server |
| Storage | better-sqlite3 | Persistent SQLite |
| Testing | Vitest | Unit and integration tests |
| Language | TypeScript (strict) | Type safety |

## Key Architectural Decisions

### 1. Engine Isolation

The `@lockitdown/engine` package is **pure logic** with:
- No I/O operations
- No external dependencies
- Deterministic behavior
- Used by both client (for UI prediction) and server (for validation)

This enables:
- Shared validation logic
- AI that runs on both client and server
- Easy testing without mocking

### 2. Server Authority

The server is the **authoritative source** for:
- Game state
- Move validation
- Win conditions
- Player assignments

The client:
- Displays state received from server
- Can predict moves locally for UI responsiveness
- Must wait for server confirmation for state changes

### 3. Room-Based Multiplayer

Games are organized into "rooms" identified by 6-character codes:

```
RoomManager (singleton)
    |
    +-- GameRoom "ABC123"
    |       |-- WebSocket Player 1
    |       |-- WebSocket Player 2
    |       +-- GameState
    |
    +-- GameRoom "XYZ789"
            +-- ...
```

### 4. State Persistence

Active games are persisted to SQLite for:
- Server restart recovery
- Game history
- Player statistics

## Communication Flow

### HTTP Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/lobby/create` | Create game room |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |

### WebSocket Protocol

Connection: `ws://server/api/game/{GAME_CODE}`

**Client -> Server Messages:**

```typescript
{ type: 'join', playerName: string }
{ type: 'move', move: GameMove }
{ type: 'startGame' }
{ type: 'startAIGame', aiDepth: number }
{ type: 'rematch' }
{ type: 'requestAI' }
{ type: 'ping' }
```

**Server -> Client Messages:**

```typescript
{ type: 'gameState', state: TransportState | null, players: string[], phase: string }
{ type: 'playerJoined', name: string, index: number }
{ type: 'playerLeft', name: string }
{ type: 'gameOver', winner: number, winnerName: string }
{ type: 'error', message: string }
{ type: 'pong' }
```

## Critical Patterns

### Two-Phase Resolution (Engine)

During move resolution, the moving robot's beam stays **OFF**:

1. Move execution sets `robot.isBeamEnabled = false` and stores `_activeRobotPosition`
2. `resolveMove()` runs, skipping the active robot entirely
3. After resolution: re-enable beam if not locked
4. Clear `_activeRobotPosition`

**Why**: Prevents a robot from being locked/destroyed by its own move.

### Transport Format

Wire format matches Go's JSON serialization:
- `player` and `playerTurn` are **1-indexed** in transport
- Internally, they are **0-indexed**
- `robots` is an array of `[position, robotData]` tuples

## See Also

- [Game Flow](./game-flow.md) - How gameplay works
- [Auth Flow](./auth-flow.md) - Authentication system
- `/packages/engine/AGENTS.md` - Engine-specific patterns
