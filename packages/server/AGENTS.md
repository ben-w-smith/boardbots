# BoardBots Server - AI Agent Guide

This document covers critical patterns and gotchas for AI agents working on the BoardBots Cloudflare Durable Object server.

---

## CRITICAL: Durable Object Hibernation

Cloudflare Durable Objects can hibernate when idle. When they wake up:

- **In-memory state is LOST** (including `this.sessions` Maps, class properties, etc.)
- **WebSockets survive** via `this.state.getWebSockets()`

This is the #1 issue that breaks production deployments.

### The Wrong Pattern

```typescript
// BROKEN: This fails after hibernation!
class GameRoom {
  private sessions = new Map<WebSocket, SessionInfo>();

  broadcast(message: string) {
    for (const [ws] of this.sessions) {
      ws.send(message);
    }
  }
}
```

After hibernation, `this.sessions` is empty even though WebSockets are still connected.

### The Correct Pattern

```typescript
// CORRECT: Survives hibernation
class GameRoom {
  broadcast(message: string) {
    for (const ws of this.state.getWebSockets()) {
      ws.send(message);
    }
  }
}
```

### Session Metadata Storage

Use WebSocket attachments for session metadata:

```typescript
// Store metadata when player joins
ws.serializeAttachment({ playerName: 'Alice', playerIndex: 0 });

// Retrieve metadata later
const meta = ws.deserializeAttachment() as SessionInfo;
```

On wake from hibernation, rebuild session info by iterating `this.state.getWebSockets()` and calling `deserializeAttachment()` on each.

---

## WebSocket Acceptance Flow

1. `fetch()` handler calls `this.state.acceptWebSocket(serverWs)`
2. DO receives messages via `webSocketMessage()` handler
3. First message from client is `{type: 'join', playerName}`
4. Handler stores metadata via `ws.serializeAttachment()`

---

## Testing Gotcha

Tests must call `mockState.acceptWebSocket(ws)` before calling `webSocketMessage()` directly. Without this, `getWebSockets()` returns empty and the test will fail.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry — routes, CORS, lobby creation, WebSocket upgrade |
| `src/game-room.ts` | `GameRoom` Durable Object — WebSocket handler, game state, multiplayer logic |
| `wrangler.toml` | Cloudflare configuration, DO bindings |

---

## Game Flow

1. **Create Lobby**: Player calls `POST /api/lobby` → gets 6-char game code
2. **Connect**: Both players connect via WebSocket to `/api/game/{CODE}`
3. **Join**: Each client sends `{type: 'join', playerName}` → server broadcasts `playerJoined` and `gameState`
4. **Start**: Host sends `{type: 'startGame'}` → server initializes game, broadcasts state with `phase: 'playing'`
5. **Play**: Client sends `{type: 'move', move}` → server validates via `applyMove()` → broadcasts new state
6. **Win**: When a player has <= 2 robots remaining → server broadcasts `gameOver`

---

## Local Development

```bash
# Start server locally (port 8787)
npx wrangler dev --port 8787

# Deploy to Cloudflare
npx wrangler deploy
```

---

## Quick Reference: Do's and Don'ts

| Do | Don't |
|----|-------|
| Use `this.state.getWebSockets()` for broadcast | Use in-memory Maps to track WebSockets |
| Store session data via `ws.serializeAttachment()` | Store session data in class properties |
| Handle empty results from `getWebSockets()` gracefully | Assume WebSockets exist without checking |
| Test hibernation scenarios explicitly | Only test happy-path scenarios |
