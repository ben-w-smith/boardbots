# BoardBots - Lock It Down

A multiplayer board game implemented as a TypeScript monorepo.

## Monorepo Structure

```
packages/
  engine/   # Pure game logic (hex grid, moves, beam resolution, AI)
  client/   # Vite SPA (canvas renderer, lobby UI, game UI, WebSocket client)
  server/   # Node.js + Express (game rooms, WebSocket server, SQLite)
  e2e/      # Playwright end-to-end tests
```

## Tech Stack

- **TypeScript** (strict mode)
- **npm workspaces** - monorepo management
- **Vite 7.x** - client bundling
- **Express 4.x** - HTTP server
- **ws** - WebSocket server
- **better-sqlite3** - persistent storage
- **Vitest** - testing
- **Playwright** - E2E testing

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

## Quick Start

```bash
# Install dependencies
npm install

# Start server (required first)
npm run dev --workspace=packages/server

# In another terminal, start client
npm run dev --workspace=packages/client
# Opens on http://localhost:5173
```

## Common Commands

```bash
# Start client dev server
npm run dev

# Start server dev mode (with hot reload)
npm run dev --workspace=packages/server

# Run all unit tests
npm run test --workspaces --if-present

# Run E2E tests
npm run test:e2e

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

## Package-Specific Documentation

Each package has its own `AGENTS.md` with package-specific guidance:

- **[packages/engine/AGENTS.md](packages/engine/AGENTS.md)** - Game logic, hex grid, AI
- **[packages/client/AGENTS.md](packages/client/AGENTS.md)** - Canvas rendering, UI, WebSocket client
- **[packages/server/AGENTS.md](packages/server/AGENTS.md)** - HTTP routes, WebSocket, database

## Deployment

See [deploy/README.md](deploy/README.md) for DigitalOcean deployment instructions.

**Production:** http://138.197.0.105 (~$6/month on DigitalOcean)
