import type { GameMove, TransportState } from '@lockitdown/engine';

// Production API URL injected by Vite
declare const __PRODUCTION_API_URL__: string;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ServerMessage {
  type: 'gameState' | 'error' | 'playerJoined' | 'playerLeft' | 'gameOver';
  state?: TransportState | null;
  players?: string[];
  phase?: string;
  message?: string;
  name?: string;
  index?: number;
  winner?: number;
  winnerName?: string;
}

export interface GameSocketOptions {
  /** Max reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Delay between reconnection attempts in ms (default: 2000) */
  reconnectDelay?: number;
  /** Base URL for WebSocket connection (default: current origin) */
  baseUrl?: string;
}

export class GameSocket {
  private ws: WebSocket | null = null;
  private gameCode: string = '';
  private playerName: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private baseUrl: string;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private _status: ConnectionStatus = 'disconnected';

  // Callbacks
  private onStateUpdateCallback: ((state: TransportState | null, players: string[], phase: string) => void) | null = null;
  private onErrorCallback: ((msg: string) => void) | null = null;
  private onStatusChangeCallback: ((status: ConnectionStatus) => void) | null = null;
  private onPlayerJoinedCallback: ((name: string, index: number) => void) | null = null;
  private onPlayerLeftCallback: ((name: string) => void) | null = null;
  private onGameOverCallback: ((winner: number, winnerName: string) => void) | null = null;

  constructor(options?: GameSocketOptions) {
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options?.reconnectDelay ?? 2000;
    this.baseUrl = options?.baseUrl ?? '';
  }

  /** Current connection status */
  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.onStatusChangeCallback?.(status);
  }

  /** Connect to a game room */
  connect(gameCode: string, playerName: string): void {
    this.gameCode = gameCode;
    this.playerName = playerName;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('connecting');

    // Use production API URL if configured, otherwise use current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = this.baseUrl || (typeof __PRODUCTION_API_URL__ !== 'undefined' && __PRODUCTION_API_URL__ ? __PRODUCTION_API_URL__ : window.location.host);
    const wsUrl = `${protocol}//${host}/api/game/${this.gameCode}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
    } catch (err) {
      this.setStatus('disconnected');
      this.onErrorCallback?.(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
      this.scheduleReconnect();
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      // Send join message
      this.send({ type: 'join', playerName: this.playerName });
    };

    this.ws.onclose = (_event) => {
      if (this._status !== 'disconnected') {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (_event) => {
      this.onErrorCallback?.('WebSocket error');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch {
        this.onErrorCallback?.('Invalid message from server');
      }
    };
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'gameState':
        if (msg.players && msg.phase) {
          this.onStateUpdateCallback?.(msg.state ?? null, msg.players, msg.phase);
        }
        break;
      case 'error':
        if (msg.message) {
          this.onErrorCallback?.(msg.message);
        }
        break;
      case 'playerJoined':
        if (msg.name !== undefined && msg.index !== undefined) {
          this.onPlayerJoinedCallback?.(msg.name, msg.index);
        }
        break;
      case 'playerLeft':
        if (msg.name) {
          this.onPlayerLeftCallback?.(msg.name);
        }
        break;
      case 'gameOver':
        if (msg.winner !== undefined && msg.winnerName) {
          this.onGameOverCallback?.(msg.winner, msg.winnerName);
        }
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onErrorCallback?.('Max reconnection attempts reached');
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.doConnect();
    }, this.reconnectDelay);
  }

  /** Attempt to reconnect */
  reconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  /** Disconnect from the game */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  /** Send a move to the server */
  sendMove(move: GameMove): void {
    this.send({ type: 'move', move });
  }

  /** Request to start the game */
  startGame(): void {
    this.send({ type: 'startGame' });
  }

  /** Request an AI move */
  requestAI(): void {
    this.send({ type: 'requestAI' });
  }

  /** Request a rematch */
  rematch(): void {
    this.send({ type: 'rematch' });
  }

  private send(msg: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // Callback registration
  onStateUpdate(callback: (state: TransportState | null, players: string[], phase: string) => void): void {
    this.onStateUpdateCallback = callback;
  }

  onError(callback: (msg: string) => void): void {
    this.onErrorCallback = callback;
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  onPlayerJoined(callback: (name: string, index: number) => void): void {
    this.onPlayerJoinedCallback = callback;
  }

  onPlayerLeft(callback: (name: string) => void): void {
    this.onPlayerLeftCallback = callback;
  }

  onGameOver(callback: (winner: number, winnerName: string) => void): void {
    this.onGameOverCallback = callback;
  }
}
