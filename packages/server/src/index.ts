import { GameRoom } from './game-room.js';

export { GameRoom };

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
}

// CORS headers for cross-origin API access
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper to add CORS headers to any response
function corsResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...init.headers },
  });
}

// Generate a random 6-character alphanumeric game code (uppercase, no confusing chars)
function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight for all API routes
    if (request.method === 'OPTIONS') {
      return corsResponse(null, { status: 204 });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return corsResponse('OK', { status: 200 });
    }

    // Create a new game lobby
    if (url.pathname === '/api/lobby/create' && request.method === 'POST') {
      // Generate a short, human-readable game code
      const gameCode = generateGameCode();
      // The GameRoom DO will be created on first WebSocket connection
      return corsResponse(JSON.stringify({ gameCode }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // WebSocket upgrade for game connection
    if (url.pathname.startsWith('/api/game/') && request.method === 'GET') {
      // Normalize game code: uppercase and trim
      let gameCode = url.pathname.replace('/api/game/', '').toUpperCase().trim();

      if (!gameCode || gameCode.length !== 6) {
        return new Response('Invalid game code', { status: 400 });
      }

      // Upgrade to WebSocket
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      // Get the Durable Object stub using the normalized game code
      const id = env.GAME_ROOM.idFromName(gameCode);
      const stub = env.GAME_ROOM.get(id);

      // Forward the WebSocket upgrade to the Durable Object
      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
