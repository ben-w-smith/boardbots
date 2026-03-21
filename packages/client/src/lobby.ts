/**
 * Lobby UI - Handles landing page, create/join game screens
 */

import { authManager } from './auth.js';
import { escapeHtml } from './utils/html.js';

export type LobbyMode = 'landing' | 'create' | 'join' | 'waiting';

export interface LobbyOptions {
  /** Container element for the lobby UI */
  container: HTMLElement;
  /** Called when player wants to create a game */
  onCreateGame: (playerName: string) => Promise<string | null>;
  /** Called when player wants to create an AI game */
  onCreateAIGame?: (playerName: string, aiDepth: number) => Promise<string | null>;
  /** Called when player wants to join a game */
  onJoinGame: (gameCode: string, playerName: string) => void;
  /** Called when a game is created and the player should connect */
  onConnectToGame?: (gameCode: string, playerName: string) => void;
  /** Called when player wants to log in */
  onLogin?: () => void;
  /** Called when player wants to register a new account */
  onRegister?: () => void;
}

const PLAYER_NAME_KEY = 'lockitdown_player_name';

/** Get saved player name from localStorage */
export function getSavedPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || '';
}

/** Save player name to localStorage */
export function savePlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

/** Extract game code from URL or code string */
export function parseGameCode(input: string): string | null {
  const trimmed = input.trim();

  // If it's a URL, extract the game code
  try {
    const url = new URL(trimmed);
    // Check for game param in URL
    const gameParam = url.searchParams.get('game');
    if (gameParam) {
      return gameParam.toUpperCase();
    }
    // Check path for /game/CODE pattern
    const pathMatch = url.pathname.match(/\/game\/([A-Z0-9]{6})/i);
    if (pathMatch) {
      return pathMatch[1].toUpperCase();
    }
  } catch {
    // Not a URL, continue
  }

  // Validate as 6-character code
  const upper = trimmed.toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(upper)) {
    return upper;
  }

  return null;
}

export class LobbyUI {
  private container: HTMLElement;
  private onCreateGame: (playerName: string) => Promise<string | null>;
  private onCreateAIGame?: (playerName: string, aiDepth: number) => Promise<string | null>;
  private onJoinGame: (gameCode: string, playerName: string) => void;
  private onConnectToGame?: (gameCode: string, playerName: string) => void;
  private onLogin?: () => void;
  private onRegister?: () => void;

  private currentMode: LobbyMode = 'landing';
  private lobbyEl: HTMLElement;
  private playerName: string;
  private gameCode: string | null = null;
  private aiDepth: number = 3; // Default to Medium difficulty

  constructor(options: LobbyOptions) {
    this.container = options.container;
    this.onCreateGame = options.onCreateGame;
    this.onCreateAIGame = options.onCreateAIGame;
    this.onJoinGame = options.onJoinGame;
    this.onConnectToGame = options.onConnectToGame;
    this.onLogin = options.onLogin;
    this.onRegister = options.onRegister;

    this.playerName = getSavedPlayerName();

    // Create lobby container
    this.lobbyEl = document.createElement('div');
    this.lobbyEl.className = 'lobby-container';
    this.container.appendChild(this.lobbyEl);

    this.render();
  }

  /** Show the lobby */
  show(): void {
    this.lobbyEl.style.display = 'flex';
  }

  /** Hide the lobby */
  hide(): void {
    this.lobbyEl.style.display = 'none';
  }

  /** Set current mode */
  setMode(mode: LobbyMode): void {
    this.currentMode = mode;
    this.render();
  }

  /** Set game code (for waiting screen) */
  setGameCode(code: string): void {
    this.gameCode = code;
    // Transition to waiting mode to show the game code
    this.currentMode = 'waiting';
    this.render();
  }

  /** Show the waiting screen with a game code (used after creating a game) */
  showWaiting(code: string): void {
    this.gameCode = code;
    this.currentMode = 'waiting';
    this.render();
    this.lobbyEl.style.display = 'flex';
  }

  /** Show error message */
  showError(message: string): void {
    const errorEl = this.lobbyEl.querySelector('.lobby-error') as HTMLElement | null;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    }
  }

  /** Render the current mode */
  private render(): void {
    switch (this.currentMode) {
      case 'landing':
        this.renderLanding();
        break;
      case 'create':
        this.renderCreate();
        break;
      case 'join':
        this.renderJoin();
        break;
      case 'waiting':
        this.renderWaiting();
        break;
    }
  }

  private renderLanding(): void {
    const hasAIGame = !!this.onCreateAIGame;
    const authState = authManager.getState();
    const isAuthenticated = authState.isAuthenticated;

    // For authenticated users, use their username
    if (isAuthenticated && authState.user) {
      this.playerName = authState.user.username;
    }

    // For logged-in users: show full game creation options
    // For guests: show new full-width landing page
    if (isAuthenticated && authState.user) {
      // Logged in - show full options
      const difficultyOptions = hasAIGame ? `
        <div class="form-group">
          <label>AI Difficulty</label>
          <div class="difficulty-selector">
            <button class="difficulty-btn ${this.aiDepth === 2 ? 'active' : ''}" data-depth="2">Easy</button>
            <button class="difficulty-btn ${this.aiDepth === 3 ? 'active' : ''}" data-depth="3">Medium</button>
            <button class="difficulty-btn ${this.aiDepth === 4 ? 'active' : ''}" data-depth="4">Hard</button>
          </div>
        </div>
      ` : '';

      this.lobbyEl.innerHTML = `
        <div class="lobby-content">
          <div class="lobby-header">
            <h1 class="lobby-title">Lock It Down</h1>
            <p class="lobby-subtitle">A hex-based tactical board game</p>
          </div>

          <div class="lobby-form">
            ${difficultyOptions}

            <div class="lobby-buttons">
              <button id="btn-create" class="primary" data-testid="create-game">Create Game</button>
              ${hasAIGame ? '<button id="btn-vs-ai" class="secondary" data-testid="vs-ai">Play vs AI</button>' : ''}
              <button id="btn-join" data-testid="join-game">Join Game</button>
            </div>

            <div class="lobby-error"></div>
          </div>
        </div>
      `;
    } else {
      // Guest - show new full-width landing page
      this.lobbyEl.innerHTML = `
        <div class="landing-container">
          <!-- Hero Section -->
          <section class="landing-hero">
            <h1 class="landing-title">Lock It Down</h1>
            <p class="landing-tagline">A hex-based tactical board game where robots battle for control</p>
            <div class="landing-hero-actions">
              <button id="btn-login" class="primary large">Log In to Play</button>
              <button id="btn-register" class="secondary large">Create Account</button>
            </div>
          </section>

          <!-- How It Works -->
          <section class="landing-info">
            <div class="info-card">
              <span class="info-icon">🤖</span>
              <h3>Place Robots</h3>
              <p>Deploy your robots onto the hex corridor</p>
            </div>
            <div class="info-card">
              <span class="info-icon">🔒</span>
              <h3>Lock Them Down</h3>
              <p>Trap your opponent's robots with beam locks</p>
            </div>
            <div class="info-card">
              <span class="info-icon">🏆</span>
              <h3>Win the Match</h3>
              <p>Lock down more robots than your opponent to win</p>
            </div>
          </section>

          <!-- Join Game (Guest) -->
          <section class="landing-join">
            <p>Have a game code? Join as a guest:</p>
            <div class="join-game-row">
              <input type="text" id="game-code" class="lobby-input" placeholder="Enter game code" maxlength="6" data-testid="game-code" />
              <button id="btn-join" class="primary" data-testid="join-game">Join</button>
            </div>
            <div class="lobby-error"></div>
          </section>
        </div>
      `;
    }

    this.setupLandingHandlers();
  }

  private setupLandingHandlers(): void {
    const nameInput = this.lobbyEl.querySelector('#player-name') as HTMLInputElement;
    const btnCreate = this.lobbyEl.querySelector('#btn-create');
    const btnJoin = this.lobbyEl.querySelector('#btn-join');
    const btnVsAI = this.lobbyEl.querySelector('#btn-vs-ai');
    const btnLogin = this.lobbyEl.querySelector('#btn-login');
    const btnRegister = this.lobbyEl.querySelector('#btn-register');
    const difficultyBtns = this.lobbyEl.querySelectorAll('.difficulty-btn');

    const authState = authManager.getState();

    // Update player name on input (only for guests)
    if (nameInput && !authState.isAuthenticated) {
      nameInput.addEventListener('input', () => {
        this.playerName = nameInput.value.trim();
      });
    }

    // Focus name input if empty and not logged in
    if (!this.playerName && nameInput && !authState.isAuthenticated) {
      nameInput.focus();
    }

    // Difficulty selector
    difficultyBtns.forEach(btn => {
      btn?.addEventListener('click', () => {
        const depth = parseInt((btn as HTMLElement).dataset.depth || '3', 10);
        this.aiDepth = depth;
        // Update active state
        difficultyBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    btnCreate?.addEventListener('click', () => {
      if (this.validateName()) {
        savePlayerName(this.playerName);
        this.handleCreateClick();
      }
    });

    btnVsAI?.addEventListener('click', () => {
      if (this.validateName()) {
        savePlayerName(this.playerName);
        this.handleVsAIClick();
      }
    });

    btnJoin?.addEventListener('click', () => {
      // For guests, generate a random name if not set
      if (!authState.isAuthenticated && !this.playerName) {
        this.playerName = `Guest_${Math.random().toString(36).substring(2, 6)}`;
      }
      // For guests, directly handle join with game code
      if (!authState.isAuthenticated) {
        const joinInput = this.lobbyEl.querySelector('#game-code') as HTMLInputElement;
        if (joinInput) {
          this.handleJoinClick(joinInput.value);
        }
      } else {
        // For logged-in users, go to join screen
        if (this.validateName()) {
          savePlayerName(this.playerName);
          this.currentMode = 'join';
          this.render();
        }
      }
    });

    // Login button - triggers login modal
    btnLogin?.addEventListener('click', () => {
      if (this.onLogin) {
        this.onLogin();
      }
    });

    // Register button - triggers register modal
    btnRegister?.addEventListener('click', () => {
      if (this.onRegister) {
        this.onRegister();
      }
    });

    // Enter key to proceed
    nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (this.validateName()) {
          savePlayerName(this.playerName);
          this.handleCreateClick();
        }
      }
    });

    // Enter key in guest game code input
    const guestJoinInput = this.lobbyEl.querySelector('#game-code') as HTMLInputElement;
    guestJoinInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (!authState.isAuthenticated && !this.playerName) {
          this.playerName = `Guest_${Math.random().toString(36).substring(2, 6)}`;
        }
        this.handleJoinClick(guestJoinInput.value);
      }
    });
  }

  private handleCreateClick(): void {
    this.currentMode = 'create';
    this.render();

    this.onCreateGame(this.playerName).then((code) => {
      if (code) {
        this.gameCode = code;
        this.currentMode = 'waiting';
        this.render();
        // Connect to game room via WebSocket
        if (this.onConnectToGame) {
          this.onConnectToGame(code, this.playerName);
        }
      } else {
        this.showError('Failed to create game. Please try again.');
        this.currentMode = 'landing';
        this.render();
      }
    }).catch(() => {
      this.showError('Failed to create game. Please try again.');
      this.currentMode = 'landing';
      this.render();
    });
  }

  private handleVsAIClick(): void {
    this.currentMode = 'create';
    this.render();

    if (!this.onCreateAIGame) {
      this.showError('AI game mode not available');
      this.currentMode = 'landing';
      this.render();
      return;
    }

    this.onCreateAIGame(this.playerName, this.aiDepth).then((code) => {
      if (code) {
        this.gameCode = code;
        this.currentMode = 'waiting';
        this.render();
        // Connect to game room via WebSocket
        if (this.onConnectToGame) {
          this.onConnectToGame(code, this.playerName);
        }
      } else {
        this.showError('Failed to create AI game. Please try again.');
        this.currentMode = 'landing';
        this.render();
      }
    }).catch(() => {
      this.showError('Failed to create AI game. Please try again.');
      this.currentMode = 'landing';
      this.render();
    });
  }

  private renderCreate(): void {
    this.lobbyEl.innerHTML = `
      <div class="lobby-content">
        <div class="lobby-header">
          <h1 class="lobby-title">Creating Game...</h1>
        </div>
        <div class="lobby-loading">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;
  }

  private renderJoin(): void {
    this.lobbyEl.innerHTML = `
      <div class="lobby-content">
        <div class="lobby-header">
          <h1 class="lobby-title">Join Game</h1>
          <p class="lobby-subtitle">Enter the game code or paste the invite link</p>
        </div>

        <div class="lobby-form">
          <div class="form-group">
            <label for="game-code">Game Code</label>
            <input
              type="text"
              id="game-code"
              class="lobby-input game-code-input"
              placeholder="AB3K9X"
              maxlength="100"
              autocomplete="off"
              autocapitalize="characters"
            />
          </div>

          <div class="lobby-buttons">
            <button id="btn-back" class="secondary">Back</button>
            <button id="btn-join-now" class="primary">Join</button>
          </div>

          <div class="lobby-error"></div>
        </div>
      </div>
    `;

    this.setupJoinHandlers();
  }

  private setupJoinHandlers(): void {
    const codeInput = this.lobbyEl.querySelector('#game-code') as HTMLInputElement;
    const btnBack = this.lobbyEl.querySelector('#btn-back');
    const btnJoinNow = this.lobbyEl.querySelector('#btn-join-now');

    // Auto-focus input
    codeInput?.focus();

    // Auto-format input (uppercase, extract code from URL)
    codeInput?.addEventListener('input', () => {
      const value = codeInput.value;
      // If it looks like a URL or long paste, try to parse it
      if (value.length > 6) {
        const code = parseGameCode(value);
        if (code) {
          codeInput.value = code;
        }
      }
    });

    btnBack?.addEventListener('click', () => {
      this.currentMode = 'landing';
      this.render();
    });

    btnJoinNow?.addEventListener('click', () => {
      this.handleJoinClick(codeInput?.value || '');
    });

    // Enter key to join
    codeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleJoinClick(codeInput.value);
      }
    });
  }

  private handleJoinClick(input: string): void {
    const code = parseGameCode(input);

    if (!code) {
      this.showError('Invalid game code. Please enter a 6-character code.');
      return;
    }

    // Generate a guest name if not set (for guest users)
    if (!this.playerName) {
      this.playerName = `Guest_${Math.random().toString(36).substring(2, 6)}`;
    }

    savePlayerName(this.playerName);
    this.onJoinGame(code, this.playerName);
  }

  private renderWaiting(): void {
    const gameUrl = this.gameCode ? `${window.location.origin}?game=${this.gameCode}` : '';

    this.lobbyEl.innerHTML = `
      <div class="lobby-content">
        <div class="lobby-header">
          <h1 class="lobby-title">Game Created!</h1>
          <p class="lobby-subtitle">Share the code below with your opponent</p>
        </div>

        <div class="lobby-form">
          <div class="game-code-display">
            <span class="game-code" data-testid="game-code">${escapeHtml(this.gameCode || '------')}</span>
          </div>

          <div class="lobby-buttons">
            <button id="btn-copy" class="secondary">Copy Link</button>
            <button id="btn-copy-code" class="secondary">Copy Code</button>
          </div>

          <div class="waiting-status">
            <div class="loading-spinner small"></div>
            <span>Waiting for opponent...</span>
          </div>

          <div class="lobby-error"></div>
        </div>
      </div>
    `;

    this.setupWaitingHandlers(gameUrl);
  }

  private setupWaitingHandlers(gameUrl: string): void {
    const btnCopy = this.lobbyEl.querySelector('#btn-copy');
    const btnCopyCode = this.lobbyEl.querySelector('#btn-copy-code');

    btnCopy?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(gameUrl);
        this.showCopySuccess(btnCopy as HTMLButtonElement);
      } catch {
        this.showError('Failed to copy link');
      }
    });

    btnCopyCode?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.gameCode || '');
        this.showCopySuccess(btnCopyCode as HTMLButtonElement);
      } catch {
        this.showError('Failed to copy code');
      }
    });
  }

  private showCopySuccess(button: HTMLButtonElement): void {
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('success');
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('success');
    }, 2000);
  }

  private validateName(): boolean {
    if (!this.playerName || this.playerName.length < 1) {
      this.showError('Please enter your name');
      return false;
    }
    if (this.playerName.length > 20) {
      this.showError('Name must be 20 characters or less');
      return false;
    }
    return true;
  }
}
