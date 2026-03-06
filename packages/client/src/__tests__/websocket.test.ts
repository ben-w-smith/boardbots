import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameSocket, type ConnectionStatus } from '../websocket.js';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static lastInstance: MockWebSocket | null = null;

  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    MockWebSocket.lastInstance = this;
  }

  send(_data: string): void {}

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  simulateClose(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

describe('GameSocket', () => {
  let socket: GameSocket;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    MockWebSocket.lastInstance = null;

    // Save and replace WebSocket
    originalWebSocket = global.WebSocket;
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket as unknown as typeof WebSocket;

    socket = new GameSocket({ maxReconnectAttempts: 3, reconnectDelay: 100 });
  });

  afterEach(() => {
    socket.disconnect();
    (global as unknown as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket;
  });

  describe('constructor', () => {
    it('creates a socket instance with default options', () => {
      const s = new GameSocket();
      expect(s.status).toBe('disconnected');
    });

    it('accepts custom options', () => {
      const s = new GameSocket({
        maxReconnectAttempts: 10,
        reconnectDelay: 5000,
        baseUrl: 'example.com',
      });
      expect(s.status).toBe('disconnected');
    });
  });

  describe('connect', () => {
    it('initiates connection to game room', () => {
      socket.connect('GAME123', 'Player1');
      expect(MockWebSocket.instances.length).toBe(1);
      expect(MockWebSocket.lastInstance?.url).toContain('GAME123');
    });

    it('sets status to connecting', () => {
      socket.connect('GAME123', 'Player1');
      expect(socket.status).toBe('connecting');
    });
  });

  describe('status', () => {
    it('reports disconnected status initially', () => {
      expect(socket.status).toBe('disconnected');
    });

    it('reports connected status after WebSocket opens', () => {
      const statusChanges: ConnectionStatus[] = [];
      socket.onStatusChange((status) => statusChanges.push(status));

      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();

      expect(statusChanges).toContain('connected');
    });
  });

  describe('onStateUpdate', () => {
    it('receives game state updates', () => {
      const stateUpdates: unknown[] = [];
      socket.onStateUpdate((state, players, phase) => {
        stateUpdates.push({ state, players, phase });
      });

      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();

      const mockState = {
        gameDef: {
          board: { hexaBoard: { arenaRadius: 4 } },
          numOfPlayers: 2,
          robotsPerPlayer: 6,
          winCondition: 'Elimination',
          movesPerTurn: 3,
        },
        players: [{ points: 0, placedRobots: 0 }, { points: 0, placedRobots: 0 }],
        robots: [],
        playerTurn: 1,
        status: 'OnGoing',
        movesThisTurn: 3,
        requiresTieBreak: false,
      };

      MockWebSocket.lastInstance?.simulateMessage({
        type: 'gameState',
        state: mockState,
        players: ['Player1', 'Player2'],
        phase: 'playing',
      });

      expect(stateUpdates.length).toBe(1);
      expect(stateUpdates[0]).toMatchObject({
        players: ['Player1', 'Player2'],
        phase: 'playing',
      });
    });
  });

  describe('onError', () => {
    it('receives error messages', () => {
      const errors: string[] = [];
      socket.onError((msg) => errors.push(msg));

      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();

      MockWebSocket.lastInstance?.simulateMessage({
        type: 'error',
        message: 'Test error',
      });

      expect(errors).toContain('Test error');
    });
  });

  describe('sendMove', () => {
    it('sends move when connected', () => {
      const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();

      const move = {
        type: 'advance' as const,
        player: 0,
        position: { q: 0, r: 0 },
      };

      socket.sendMove(move);

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: 'move', move }));
    });

    it('does not send move when disconnected', () => {
      const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

      socket.sendMove({ type: 'advance', player: 0, position: { q: 0, r: 0 } });

      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('startGame', () => {
    it('sends startGame message', () => {
      const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();

      socket.startGame();

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: 'startGame' }));
    });
  });

  describe('requestAI', () => {
    it('sends requestAI message', () => {
      const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();

      socket.requestAI();

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: 'requestAI' }));
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket', () => {
      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();

      socket.disconnect();

      expect(socket.status).toBe('disconnected');
    });
  });

  describe('reconnect', () => {
    it('can manually reconnect', () => {
      socket.connect('GAME123', 'Player1');
      MockWebSocket.lastInstance?.simulateOpen();
      socket.disconnect();

      socket.reconnect();

      expect(MockWebSocket.instances.length).toBe(2);
    });
  });
});
