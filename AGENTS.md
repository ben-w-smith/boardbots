# BoardBots - Lock It Down

A multiplayer board game implemented as a TypeScript monorepo.

## Monorepo Structure

```
packages/
  engine/   # Pure game logic (hex grid, moves, beam resolution, AI)
  client/   # Vite SPA (canvas renderer, lobby UI, game UI, WebSocket client)
  server/   # Node.js + Express (game rooms, WebSocket server, SQLite)
```

## Tech Stack

- **TypeScript** (strict mode)
- **npm workspaces** - monorepo management
- **Vite 7.x** - client bundling
- **Express 4.x** - HTTP server
- **ws** - WebSocket server
- **better-sqlite3** - persistent storage
- **Vitest** - testing

## Architecture

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

**Key points:**
- Engine is pure logic with no I/O dependencies
- Client and Server both depend on Engine
- Server holds authoritative game state and broadcasts updates
- SQLite persists active game rooms

## Common Commands

```bash
# Install dependencies
npm install

# Start client dev server
npm run dev

# Start server dev mode (with hot reload)
npm run dev --workspace=packages/server

# Run all tests
npm run test --workspaces --if-present

# Build all packages for production
npm run build

# Start server in production mode
npm run start --workspace=packages/server
```

## Package Dependencies

- `@lockitdown/engine` - shared game logic
  - No dependencies on client or server
- `client` - depends on `@lockitdown/engine`
- `@lockitdown/server` - depends on `@lockitdown/engine`

## Development Notes

- Engine must be built before client/server can import it
- Server uses in-memory RoomManager for active game rooms with SQLite persistence
- Client connects via WebSocket to server for real-time gameplay

## Deployment

See [deploy/README.md](deploy/README.md) for DigitalOcean deployment instructions.

**Production:** http://138.197.0.105 (~$6/month on DigitalOcean)
