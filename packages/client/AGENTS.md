# BoardBots Client - Agent Development Guide

This document covers critical friction points when working with the BoardBots Vite client.

## Critical Friction Points

### 1. Vite Proxy Configuration (REQUIRED for local dev)

**This is the #1 issue that breaks local development.**

The client requires `vite.config.ts` to have a proxy that forwards `/api/*` requests to the Wrangler dev server:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
})
```

**Without this proxy:**
- API calls to `/api/*` will fail
- The app will redirect back to the landing page
- Authentication and game operations will not work

**Verification:** If the app keeps redirecting to the landing page during local dev, check the Vite proxy configuration first.

### 2. Canvas Rendering Loop

The renderer uses `requestAnimationFrame` for the main render loop:
- Runs continuously during active animations
- Renderer draws: hex grid, robots, beams, highlights
- Animator handles these animation types:
  - `advance` - robot sliding movement
  - `turn` - robot rotation animation
  - `placement` - scale-in effect when robot spawns
  - `destruction` - particle effects when robot dies

### 3. Null State Handling

`gameState` messages can have `state: null` before the game starts (during waiting phase). The client must handle this gracefully:

```typescript
// In websocket callback
if (transportState) {
  // Update game state
  const gameState = fromTransport(transportState);
  // ...
}
// Even if state is null, still process player list updates
```

**Do not assume gameState is always non-null.** Always check before accessing game state properties.

### 4. Input Modes

The client uses two input modes (the unused 'place' mode was removed):
- `'select'` - Click to select a robot
- `'selectDirection'` - Click to choose move direction

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | App entry — wires lobby, game UI, WebSocket, renderer together |
| `src/websocket.ts` | `GameSocket` class — WebSocket client with reconnect |
| `src/lobby.ts` | `LobbyUI` — create/join game screens |
| `src/gameui.ts` | `GameUI` — in-game HUD, buttons, move history |
| `src/renderer.ts` | Canvas hex grid renderer with robot sprites and beams |
| `src/input.ts` | `InputHandler` — click-to-select, move dispatch |
| `src/animator.ts` | Animation system (advance, turn, placement, destruction) |
| `vite.config.ts` | Vite config with proxy to backend |
| `src/webmcp.ts` | WebMCP support for Model Context Protocol integration |

## Local Development

**Prerequisites:** The backend server must be running before starting the frontend.

```bash
# Terminal 1: Backend (must be running first)
cd packages/server && npx wrangler dev --port 8787

# Terminal 2: Frontend
cd packages/client && npx vite
# Opens on http://localhost:5173 (or next available port)
```

**Common Issues:**

1. **API calls failing** - Ensure Vite proxy is configured and backend is running on port 8787
2. **WebSocket not connecting** - Check that backend is running and accessible
3. **Blank screen on game load** - Check browser console for errors, verify null state handling

## WebMCP Integration

The client includes WebMCP support via `src/webmcp.ts` for Model Context Protocol integration with the game UI. This enables AI assistants to interact with the game state and UI programmatically.
