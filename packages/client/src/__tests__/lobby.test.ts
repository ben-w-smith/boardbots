import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  LobbyUI,
  getSavedPlayerName,
  savePlayerName,
  parseGameCode,
} from '../lobby.js';
import { authManager } from '../auth.js';

// Mock authManager
vi.mock('../auth.js', () => ({
  authManager: {
    getState: vi.fn(() => ({ isAuthenticated: false, user: null })),
    getUser: vi.fn(() => null),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Helper to create a mock container
function createMockContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
  return container;
}

// Helper to clean up DOM
function cleanupDOM() {
  document.body.innerHTML = '';
}

describe('Lobby', () => {
  describe('parseGameCode', () => {
    it('parses valid 6-character codes', () => {
      expect(parseGameCode('AB3K9X')).toBe('AB3K9X');
      expect(parseGameCode('ab3k9x')).toBe('AB3K9X');
      expect(parseGameCode('  ab3k9x  ')).toBe('AB3K9X');
    });

    it('returns null for invalid codes', () => {
      expect(parseGameCode('')).toBeNull();
      expect(parseGameCode('AB3K9')).toBeNull();
      expect(parseGameCode('AB3K9XX')).toBeNull();
      expect(parseGameCode('invalid')).toBeNull();
    });

    it('extracts game code from URL with query param', () => {
      expect(parseGameCode('https://example.com?game=AB3K9X')).toBe('AB3K9X');
      expect(parseGameCode('https://example.com/?game=AB3K9X&other=param')).toBe('AB3K9X');
    });

    it('extracts game code from URL with path', () => {
      expect(parseGameCode('https://example.com/game/AB3K9X')).toBe('AB3K9X');
      expect(parseGameCode('https://benwsmith.com/game/AB3K9X')).toBe('AB3K9X');
    });

    it('handles invalid URLs gracefully', () => {
      expect(parseGameCode('not-a-url')).toBeNull();
    });
  });

  describe('localStorage helpers', () => {
    beforeEach(() => {
      localStorageMock.clear();
    });

    it('saves and retrieves player name', () => {
      savePlayerName('TestPlayer');
      expect(getSavedPlayerName()).toBe('TestPlayer');
    });

    it('returns empty string when no name saved', () => {
      expect(getSavedPlayerName()).toBe('');
    });
  });
});

describe('LobbyUI', () => {
  let container: HTMLElement;
  let lobbyUI: LobbyUI;
  let createGameCalls: { playerName: string }[];
  let joinGameCalls: { gameCode: string; playerName: string }[];

  beforeEach(() => {
    vi.mocked(authManager.getState).mockReturnValue({ isAuthenticated: false, user: null });
    vi.mocked(authManager.getUser).mockReturnValue(null);
    container = createMockContainer();
    createGameCalls = [];
    joinGameCalls = [];

    lobbyUI = new LobbyUI({
      container,
      onCreateGame: async (playerName: string) => {
        createGameCalls.push({ playerName });
        return 'TEST99';
      },
      onJoinGame: (gameCode: string, playerName: string) => {
        joinGameCalls.push({ gameCode, playerName });
      },
    });
  });

  afterEach(() => {
    cleanupDOM();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates a LobbyUI instance', () => {
      expect(lobbyUI).toBeInstanceOf(LobbyUI);
    });

    it('renders the landing page by default with title Lock It Down', () => {
      // Guest landing uses landing-title, authenticated uses lobby-title
      const landingTitle = container.querySelector('.landing-title');
      const lobbyTitle = container.querySelector('.lobby-title');
      expect(landingTitle?.textContent || lobbyTitle?.textContent).toBe('Lock It Down');
    });

    it('shows login and register buttons on guest landing page', () => {
      const btnLogin = container.querySelector('#btn-login');
      const btnRegister = container.querySelector('#btn-register');
      expect(btnLogin).not.toBeNull();
      expect(btnRegister).not.toBeNull();
    });

    it('shows game code input for guest join', () => {
      const codeInput = container.querySelector('#game-code');
      expect(codeInput).not.toBeNull();
    });

    it('does NOT show player name input on guest landing page', () => {
      const nameInput = container.querySelector('#player-name');
      expect(nameInput).toBeNull();
    });
  });

  describe('show/hide', () => {
    it('shows the lobby', () => {
      lobbyUI.hide();
      lobbyUI.show();
      const lobbyEl = container.querySelector('.lobby-container') as HTMLElement;
      expect(lobbyEl.style.display).toBe('flex');
    });

    it('hides the lobby', () => {
      lobbyUI.hide();
      const lobbyEl = container.querySelector('.lobby-container') as HTMLElement;
      expect(lobbyEl.style.display).toBe('none');
    });
  });

  describe('guest landing page', () => {
    it('calls onLogin when login button is clicked', () => {
      cleanupDOM();
      container = createMockContainer();
      const onLogin = vi.fn();
      const newLobbyUI = new LobbyUI({
        container,
        onCreateGame: async () => 'TEST99',
        onJoinGame: () => {},
        onLogin,
      });

      const btnLogin = container.querySelector('#btn-login') as HTMLButtonElement;
      btnLogin?.click();

      expect(onLogin).toHaveBeenCalled();
    });

    it('calls onRegister when register button is clicked', () => {
      cleanupDOM();
      container = createMockContainer();
      const onRegister = vi.fn();
      const newLobbyUI = new LobbyUI({
        container,
        onCreateGame: async () => 'TEST99',
        onJoinGame: () => {},
        onRegister,
      });

      const btnRegister = container.querySelector('#btn-register') as HTMLButtonElement;
      btnRegister?.click();

      expect(onRegister).toHaveBeenCalled();
    });

    it('generates guest name and joins game when join clicked with valid code', () => {
      const codeInput = container.querySelector('#game-code') as HTMLInputElement;
      codeInput.value = 'AB3K9X';

      const btnJoin = container.querySelector('#btn-join') as HTMLButtonElement;
      btnJoin?.click();

      expect(joinGameCalls.length).toBe(1);
      expect(joinGameCalls[0]?.gameCode).toBe('AB3K9X');
      expect(joinGameCalls[0]?.playerName).toMatch(/^Guest_/);
    });

    it('shows error for invalid game code', () => {
      const codeInput = container.querySelector('#game-code') as HTMLInputElement;
      codeInput.value = 'invalid';

      const btnJoin = container.querySelector('#btn-join') as HTMLButtonElement;
      btnJoin?.click();

      const errorEl = container.querySelector('.lobby-error');
      expect(errorEl?.textContent).toContain('Invalid game code');
    });
  });

  describe('authenticated landing page', () => {
    beforeEach(() => {
      cleanupDOM();
      vi.mocked(authManager.getState).mockReturnValue({
        isAuthenticated: true,
        user: { username: 'testuser' },
      });
      vi.mocked(authManager.getUser).mockReturnValue({ username: 'testuser' } as any);

      container = createMockContainer();
      createGameCalls = [];
      joinGameCalls = [];

      lobbyUI = new LobbyUI({
        container,
        onCreateGame: async (playerName: string) => {
          createGameCalls.push({ playerName });
          return 'TEST99';
        },
        onJoinGame: (gameCode: string, playerName: string) => {
          joinGameCalls.push({ gameCode, playerName });
        },
        onCreateAIGame: async (playerName: string, aiDepth: number) => {
          return 'AI99';
        },
      });
    });

    afterEach(() => {
      cleanupDOM();
    });

    it('shows create, vs AI, and join buttons when authenticated', () => {
      const btnCreate = container.querySelector('#btn-create');
      const btnVsAI = container.querySelector('#btn-vs-ai');
      const btnJoin = container.querySelector('#btn-join');
      expect(btnCreate).not.toBeNull();
      expect(btnVsAI).not.toBeNull();
      expect(btnJoin).not.toBeNull();
    });

    it('transitions to join mode when join button clicked', () => {
      const btnJoin = container.querySelector('#btn-join') as HTMLButtonElement;
      btnJoin?.click();

      const title = container.querySelector('.lobby-title');
      expect(title?.textContent).toBe('Join Game');
    });

    it('shows difficulty selector for AI games', () => {
      const difficultyBtns = container.querySelectorAll('.difficulty-btn');
      expect(difficultyBtns.length).toBe(3);
    });
  });

  describe('join screen (authenticated)', () => {
    beforeEach(() => {
      cleanupDOM();
      // Set up authenticated state
      vi.mocked(authManager.getState).mockReturnValue({
        isAuthenticated: true,
        user: { username: 'testuser' },
      });
      vi.mocked(authManager.getUser).mockReturnValue({ username: 'testuser' } as any);

      container = createMockContainer();
      createGameCalls = [];
      joinGameCalls = [];

      lobbyUI = new LobbyUI({
        container,
        onCreateGame: async (playerName: string) => {
          createGameCalls.push({ playerName });
          return 'TEST99';
        },
        onJoinGame: (gameCode: string, playerName: string) => {
          joinGameCalls.push({ gameCode, playerName });
        },
      });

      // Click join button to go to join screen
      const btnJoin = container.querySelector('#btn-join') as HTMLButtonElement;
      btnJoin?.click();
    });

    it('shows game code input', () => {
      const codeInput = container.querySelector('#game-code');
      expect(codeInput).not.toBeNull();
    });

    it('shows back button', () => {
      const btnBack = container.querySelector('#btn-back');
      expect(btnBack).not.toBeNull();
    });

    it('goes back to landing when back clicked', () => {
      const btnBack = container.querySelector('#btn-back') as HTMLButtonElement;
      btnBack?.click();

      const title = container.querySelector('.lobby-title');
      expect(title?.textContent).toBe('Lock It Down');
    });

    it('shows error for invalid code', () => {
      const codeInput = container.querySelector('#game-code') as HTMLInputElement;
      codeInput.value = 'invalid';
      const btnJoinNow = container.querySelector('#btn-join-now') as HTMLButtonElement;
      btnJoinNow?.click();

      const errorEl = container.querySelector('.lobby-error');
      expect(errorEl?.textContent).toContain('Invalid game code');
    });

    it('calls onJoinGame with valid code', () => {
      const codeInput = container.querySelector('#game-code') as HTMLInputElement;
      codeInput.value = 'AB3K9X';
      const btnJoinNow = container.querySelector('#btn-join-now') as HTMLButtonElement;
      btnJoinNow?.click();

      expect(joinGameCalls.length).toBe(1);
      expect(joinGameCalls[0]?.gameCode).toBe('AB3K9X');
      expect(joinGameCalls[0]?.playerName).toBe('testuser');
    });

    it('auto-formats URL paste to code', () => {
      const codeInput = container.querySelector('#game-code') as HTMLInputElement;
      codeInput.value = 'https://example.com?game=AB3K9X';
      codeInput.dispatchEvent(new Event('input'));

      expect(codeInput.value).toBe('AB3K9X');
    });
  });

  describe('waiting screen', () => {
    it('shows game code in waiting mode', () => {
      lobbyUI.setGameCode('AB3K9X');

      const gameCodeEl = container.querySelector('.game-code');
      expect(gameCodeEl?.textContent).toBe('AB3K9X');
    });

    it('shows copy buttons', () => {
      lobbyUI.setGameCode('AB3K9X');

      const btnCopy = container.querySelector('#btn-copy');
      const btnCopyCode = container.querySelector('#btn-copy-code');
      expect(btnCopy).not.toBeNull();
      expect(btnCopyCode).not.toBeNull();
    });

    it('shows waiting message', () => {
      lobbyUI.setGameCode('AB3K9X');

      const waitingStatus = container.querySelector('.waiting-status');
      expect(waitingStatus?.textContent).toContain('Waiting for opponent');
    });
  });

  describe('setMode', () => {
    it('renders create mode', () => {
      lobbyUI.setMode('create');
      const title = container.querySelector('.lobby-title');
      expect(title?.textContent).toBe('Creating Game...');
    });

    it('renders landing mode', () => {
      lobbyUI.setMode('create');
      lobbyUI.setMode('landing');
      // Guest landing uses landing-title
      const landingTitle = container.querySelector('.landing-title');
      const lobbyTitle = container.querySelector('.lobby-title');
      expect(landingTitle?.textContent || lobbyTitle?.textContent).toBe('Lock It Down');
    });
  });

  describe('showError', () => {
    it('displays error message', () => {
      lobbyUI.showError('Test error message');

      const errorEl = container.querySelector('.lobby-error');
      expect(errorEl?.textContent).toBe('Test error message');
    });
  });
});
