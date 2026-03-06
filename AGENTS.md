# BoardBots - Lock It Down

A multiplayer board game implemented as a TypeScript monorepo.

## Monorepo Structure

```
packages/
  engine/   # Pure game logic (hex grid, moves, beam resolution, AI)
  client/   # Vite SPA (canvas renderer, lobby UI, game UI, WebSocket client)
  server/   # Cloudflare Worker + Durable Object (game rooms, WebSocket server)
```

## Tech Stack

- **TypeScript** (strict mode)
- **pnpm workspaces** - monorepo management
- **Vite 7.x** - client bundling
- **Wrangler 3.x** - Cloudflare Workers/DO deployment
- **Vitest** - testing
- **Cloudflare Durable Objects** - stateful game rooms

## Architecture

```
+----------------+     WebSocket      +------------------+
|  Client (Vite) | <----------------> | Server (Worker + |
|  - Canvas UI   |                    | Durable Object)  |
|  - Game state  |                    | - Game rooms     |
+----------------+                    | - WebSocket srv  |
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

## Common Commands

```bash
# Start client dev server
npm run dev

# Run all tests
npm run test --workspaces --if-present

# Build client for production
npm run build --workspace=packages/client

# Start backend locally (port 8787)
cd packages/server && npx wrangler dev --port 8787

# Deploy server to Cloudflare
cd packages/server && npx wrangler deploy

# Build engine (required before client/server can import it)
npm run build --workspace=packages/engine
```

## Package Dependencies

- `@lockitdown/engine` - shared game logic
  - No dependencies on client or server
- `client` - depends on `@lockitdown/engine`
- `@lockitdown/server` - depends on `@lockitdown/engine`

## Development Notes

- Engine must be built before client/server can import it
- Server uses Cloudflare Durable Objects for stateful game rooms
- Client connects via WebSocket to server for real-time gameplay
