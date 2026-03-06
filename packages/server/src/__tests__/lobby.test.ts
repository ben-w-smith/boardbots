import { describe, it, expect, vi } from 'vitest';
import worker from '../index.js';

// Track which game codes were used to get DO stubs
const stubCalls: string[] = [];

// Mock environment with GAME_ROOM Durable Object namespace
function createMockEnv(): { GAME_ROOM: DurableObjectNamespace } {
  stubCalls.length = 0;

  return {
    GAME_ROOM: {
      idFromName: (name: string) => {
        return { id: name } as unknown as DurableObjectId;
      },
      get: (id: DurableObjectId) => {
        const name = (id as unknown as { id: string }).id;
        stubCalls.push(name);
        // Return a mock stub that just tracks the call
        return {
          fetch: async () => new Response('OK', { status: 200 }),
        } as unknown as DurableObjectStub;
      },
    } as unknown as DurableObjectNamespace,
  };
}

describe('Lobby System', () => {
  describe('POST /api/lobby/create', () => {
    it('returns a 6-character game code', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/lobby/create', {
        method: 'POST',
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(200);

      const data = (await response.json()) as { gameCode: string };
      expect(data.gameCode).toBeDefined();
      expect(data.gameCode.length).toBe(6);
    });

    it('returns uppercase alphanumeric game codes', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/lobby/create', {
        method: 'POST',
      });

      const response = await worker.fetch(request, env);
      const data = (await response.json()) as { gameCode: string };

      // Should only contain uppercase letters and numbers (no confusing chars)
      expect(data.gameCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    });

    it('returns unique game codes', async () => {
      const env = createMockEnv();
      const codes = new Set<string>();

      // Generate multiple codes and check uniqueness
      for (let i = 0; i < 100; i++) {
        const request = new Request('http://localhost/api/lobby/create', {
          method: 'POST',
        });
        const response = await worker.fetch(request, env);
        const data = (await response.json()) as { gameCode: string };
        codes.add(data.gameCode);
      }

      // With 32^6 possible codes, 100 should all be unique
      expect(codes.size).toBe(100);
    });
  });

  describe('GET /api/game/:gameCode', () => {
    it('rejects non-websocket requests with 426', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/game/ABC123', {
        method: 'GET',
      });

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(426); // Upgrade Required
    });

    it('rejects invalid game codes', async () => {
      const env = createMockEnv();

      // Too short
      const request1 = new Request('http://localhost/api/game/ABC12', {
        method: 'GET',
        headers: { Upgrade: 'websocket' },
      });
      const response1 = await worker.fetch(request1, env);
      expect(response1.status).toBe(400);

      // Too long
      const request2 = new Request('http://localhost/api/game/ABC1234', {
        method: 'GET',
        headers: { Upgrade: 'websocket' },
      });
      const response2 = await worker.fetch(request2, env);
      expect(response2.status).toBe(400);
    });

    it('normalizes game codes to uppercase', async () => {
      const env = createMockEnv();

      // Lowercase input should be normalized to uppercase
      const request = new Request('http://localhost/api/game/abc123', {
        method: 'GET',
        headers: { Upgrade: 'websocket' },
      });

      await worker.fetch(request, env);

      // The DO stub should have been called with uppercase code
      expect(stubCalls).toContain('ABC123');
    });

    it('routes valid game codes to Durable Object stub', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/game/ABC123', {
        method: 'GET',
        headers: { Upgrade: 'websocket' },
      });

      await worker.fetch(request, env);

      // Verify the stub was called with the correct game code
      expect(stubCalls).toContain('ABC123');
    });
  });

  describe('Health check', () => {
    it('returns OK for health endpoint', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/health');

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('OK');
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 for unknown paths', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/unknown');

      const response = await worker.fetch(request, env);
      expect(response.status).toBe(404);
    });
  });
});
