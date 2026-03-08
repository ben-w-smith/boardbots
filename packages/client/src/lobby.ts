/**
 * Lobby UI - Handles landing page, create/join game screens
 */

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
          <div class="form-group">
            <label for="player-name">Your Name</label>
            <input
              type="text"
              id="player-name"
              class="lobby-input"
              placeholder="Enter your name"
              value="${this.escapeHtml(this.playerName)}"
              maxlength="20"
              autocomplete="off"
            />
          </div>

          ${difficultyOptions}

          <div class="lobby-buttons">
            <button id="btn-create" class="primary">Create Game</button>
            ${hasAIGame ? '<button id="btn-vs-ai" class="secondary">Play vs AI</button>' : ''}
            <button id="btn-join">Join Game</button>
          </div>

          <div class="lobby-error"></div>
        </div>

        <div class="lobby-instructions">
          <p>Place robots on the corridor, then move them to lock down your opponent's bots!</p>
        </div>
      </div>
    `;

    this.setupLandingHandlers();
  }

  private setupLandingHandlers(): void {
    const nameInput = this.lobbyEl.querySelector('#player-name') as HTMLInputElement;
    const btnCreate = this.lobbyEl.querySelector('#btn-create');
    const btnJoin = this.lobbyEl.querySelector('#btn-join');
    const btnVsAI = this.lobbyEl.querySelector('#btn-vs-ai');
    const difficultyBtns = this.lobbyEl.querySelectorAll('.difficulty-btn');

    // Update player name on input
    nameInput?.addEventListener('input', () => {
      this.playerName = nameInput.value.trim();
    });

    // Focus name input if empty
    if (!this.playerName && nameInput) {
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
      if (this.validateName()) {
        savePlayerName(this.playerName);
        this.currentMode = 'join';
        this.render();
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

    if (!this.playerName) {
      this.showError('Please enter your name first.');
      this.currentMode = 'landing';
      this.render();
      return;
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
            <span class="game-code">${this.gameCode || '------'}</span>
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
