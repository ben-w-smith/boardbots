/**
 * Application coordinator - manages route components and navigation
 */

import { BoardRenderer, type Highlight } from './renderer.js';
import { StarRenderer } from './star-renderer.js';
import { GameUI } from './gameui.js';
import { InputHandler, type InputState } from './input.js';
import { GameSocket, type ConnectionStatus } from './websocket.js';
import { LobbyUI, getSavedPlayerName, savePlayerName } from './lobby.js';
import { authManager, type User } from './auth.js';
import { LoginModal } from './login-modal.js';
import { LoginPage } from './login-page.js';
import { RegisterPage } from './register-page.js';
import { DashboardUI } from './dashboard.js';
import { TopBar } from './topbar.js';
import { router, type RouteParams } from './router.js';
import { animator } from './animator.js';
import { getAudioManager } from './audio.js';
import { requireAuth, requireGuest, registerRoutes } from './routes/index.js';
import {
  initWebMCP,
  logMoveForMCP,
  clearMoveHistory,
  type WebMCPContext,
} from './webmcp.js';
import {
  createGame,
  fromTransport,
  pairEq,
  pairKey,
  pairDist,
  pairSub,
  pairAdd,
  type GameState,
  type GameMove,
  type Robot,
  CARDINALS,
} from '@lockitdown/engine';

// Game configuration
const GAME_DEF = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  movesPerTurn: 3,
  robotsPerPlayer: 6,
  winCondition: 'Elimination',
};

/** Route component interface */
export interface RouteComponent {
  show(): void | Promise<void>;
  hide(): void;
}

/**
 * Main application class - coordinates all components and routing
 */
export class App {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private starCanvas: HTMLCanvasElement;

  // Components
  private topBar: TopBar;
  private lobbyUI: LobbyUI;
  private dashboardUI: DashboardUI;
  private gameUI: GameUI;
  private loginModal: LoginModal;
  private loginPage: LoginPage;
  private registerPage: RegisterPage;
  private renderer: BoardRenderer;
  private starRenderer: StarRenderer;
  private inputHandler: InputHandler;
  private socket: GameSocket;
  private audioManager: ReturnType<typeof getAudioManager>;

  // State
  private state = createGame(GAME_DEF);
  private previousState: GameState | null = null;
  private highlights: Highlight[] = [];
  private inputState: InputState;
  private myPlayerIndex = 0;
  private currentGameCode: string = '';
  private currentPlayerName: string = '';
  private currentPlayers: string[] = [];
  private currentPhase: string = 'waiting';
  private isConnected = false;

  // Current visible route
  private currentRoute: string = '';

  constructor() {
    this.container = document.getElementById('app')!;
    this.canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')!;
    this.starCanvas = document.querySelector<HTMLCanvasElement>('#starCanvas')!;

    // Initialize audio
    this.audioManager = getAudioManager();

    // Initialize star background renderer
    this.starRenderer = new StarRenderer(this.starCanvas);

    // Initialize renderer
    this.renderer = new BoardRenderer(this.canvas, { animator });

    // Initialize socket
    this.socket = new GameSocket({
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
    });

    // Initialize input handler
    this.inputHandler = new InputHandler({
      onMove: (move: GameMove) => {
        if (this.inputState.selectedRobot && (move.type === 'turn' || move.type === 'advance')) {
          move = { ...move, position: this.inputState.selectedRobot.position };
        }
        this.socket.sendMove(move);
        this.logMove(move);
      },
      onStateChange: (newState: InputState) => {
        this.inputState = newState;
        this.updateHighlights();
        this.gameUI.updateInputState(this.inputState, this.inputState.selectedRobot?.position ?? null);
        this.gameUI.setSelectedRobotPosition(this.inputState.selectedRobot?.position ?? null);
        this.render();
      },
    });
    this.inputState = this.inputHandler.getState();
    this.inputHandler.setGameState(this.state);
    this.inputHandler.setPlayerIndex(this.myPlayerIndex);

    // Initialize UI components
    this.gameUI = this.createGameUI();
    this.loginModal = this.createLoginModal();
    this.topBar = this.createTopBar();
    this.dashboardUI = this.createDashboardUI();
    this.lobbyUI = this.createLobbyUI();
    this.loginPage = this.createLoginPage();
    this.registerPage = this.createRegisterPage();

    // Setup socket callbacks
    this.setupSocketCallbacks();

    // Setup event listeners
    this.setupEventListeners();

    // Register routes
    this.registerRoutes();

    // Initialize WebMCP
    this.initWebMCP();
  }

  private createGameUI(): GameUI {
    return new GameUI({
      container: this.container,
      onMove: (move: GameMove) => {
        if (this.inputState.selectedRobot) {
          move = { ...move, position: this.inputState.selectedRobot.position };
          this.socket.sendMove(move);
          this.logMove(move);
        }
      },
      onRequestAI: () => this.socket.requestAI(),
      onStartGame: () => this.socket.startGame(),
      onRematch: () => {
        this.socket.rematch();
        this.gameUI.hideGameOver();
        this.resetGame();
      },
      onResign: () => this.socket.resign(),
      onGoToDashboard: () => router.navigate('/dashboard'),
      onNewGame: async () => {
        try {
          const response = await authManager.authFetch('/api/lobby/create', { method: 'POST' });
          if (response.ok) {
            const data = await response.json();
            this.resetGame();
            this.currentGameCode = data.gameCode;
            router.navigate('/game', { gameCode: data.gameCode });
            const playerName = this.currentPlayerName || authManager.getState().user?.username || this.generatePlayerName();
            this.socket.connect(data.gameCode, playerName);
            this.dashboardUI.hide();
            this.lobbyUI.showWaiting(data.gameCode);
          } else if (response.status === 401) {
            router.navigate('/');
          }
        } catch (error) {
          console.error('Failed to create new game:', error);
          router.navigate('/dashboard');
        }
      },
    });
  }

  private createLoginModal(): LoginModal {
    return new LoginModal({
      container: this.container,
      onLogin: () => {
        // Auth state change will be picked up by authManager.subscribe
      },
    });
  }

  private createTopBar(): TopBar {
    return new TopBar({
      container: this.container,
      onNavigate: (route: 'home' | 'dashboard') => {
        if (route === 'home') {
          router.navigate('/');
        } else if (route === 'dashboard') {
          router.navigate('/dashboard');
        }
      },
      onLogin: () => this.loginModal.show('login'),
      onLogout: () => {
        authManager.logout();
        this.topBar.update();
        router.navigate('/');
      },
    });
  }

  private createDashboardUI(): DashboardUI {
    return new DashboardUI({
      container: this.container,
      onCreateGame: async (playerName: string): Promise<string | null> => {
        this.currentPlayerName = playerName;
        savePlayerName(playerName);
        try {
          const response = await authManager.authFetch('/api/lobby/create', { method: 'POST' });
          if (response.ok) {
            const data = await response.json();
            this.currentGameCode = data.gameCode;
            router.navigate('/game', { gameCode: data.gameCode });
            this.socket.connect(data.gameCode, playerName);
            this.dashboardUI.hide();
            this.lobbyUI.showWaiting(data.gameCode);
            return data.gameCode;
          } else if (response.status === 401) {
            this.loginModal.show('login');
            return null;
          }
        } catch (error) {
          console.error('Failed to create game:', error);
        }
        return null;
      },
      onCreateAIGame: async (playerName: string, aiDepth: number): Promise<string | null> => {
        console.log('[AI Game] onCreateAIGame called, playerName:', playerName, 'aiDepth:', aiDepth);
        this.currentPlayerName = playerName;
        savePlayerName(playerName);
        try {
          console.log('[AI Game] Creating lobby...');
          const response = await authManager.authFetch('/api/lobby/create', { method: 'POST' });
          console.log('[AI Game] Lobby response status:', response.status);
          if (response.status === 401) {
            this.loginModal.show('login');
            return null;
          }
          if (response.ok) {
            const data = await response.json();
            console.log('[AI Game] Got game code:', data.gameCode);
            console.log('[AI Game] Connecting WebSocket...');
            this.socket.connect(data.gameCode, playerName);
            this.socket.startAIGameWhenJoined(aiDepth);
            return data.gameCode;
          }
        } catch (error) {
          console.error('[AI Game] Failed to create AI game:', error);
        }
        return null;
      },
      onJoinGame: (gameCode: string, playerName: string) => {
        this.currentPlayerName = playerName;
        this.currentGameCode = gameCode;
        savePlayerName(playerName);
        router.navigate('/game', { gameCode });
        this.connectToGame(gameCode, playerName);
      },
      onLogout: () => {
        this.lobbyUI.show();
      },
    });
  }

  private createLobbyUI(): LobbyUI {
    return new LobbyUI({
      container: this.container,
      onCreateGame: async (playerName: string): Promise<string | null> => {
        this.currentPlayerName = playerName;
        savePlayerName(playerName);
        try {
          const response = await authManager.authFetch('/api/lobby/create', { method: 'POST' });
          if (response.ok) {
            const data = await response.json();
            return data.gameCode;
          } else if (response.status === 401) {
            this.loginModal.show('login');
            return null;
          }
        } catch (error) {
          console.error('Failed to create game:', error);
        }
        return null;
      },
      onCreateAIGame: async (playerName: string, aiDepth: number): Promise<string | null> => {
        console.log('[AI Game] onCreateAIGame called, playerName:', playerName, 'aiDepth:', aiDepth);
        this.currentPlayerName = playerName;
        savePlayerName(playerName);
        try {
          console.log('[AI Game] Creating lobby...');
          const response = await authManager.authFetch('/api/lobby/create', { method: 'POST' });
          console.log('[AI Game] Lobby response status:', response.status);
          if (response.status === 401) {
            this.loginModal.show('login');
            return null;
          }
          if (response.ok) {
            const data = await response.json();
            console.log('[AI Game] Got game code:', data.gameCode);
            console.log('[AI Game] Connecting WebSocket...');
            this.socket.connect(data.gameCode, playerName);
            this.socket.startAIGameWhenJoined(aiDepth);
            return data.gameCode;
          }
        } catch (error) {
          console.error('[AI Game] Failed to create AI game:', error);
        }
        return null;
      },
      onJoinGame: (gameCode: string, playerName: string) => {
        this.currentPlayerName = playerName;
        this.currentGameCode = gameCode;
        savePlayerName(playerName);
        router.navigate('/game', { gameCode });
        this.connectToGame(gameCode, playerName);
      },
      onConnectToGame: (gameCode: string, playerName: string) => {
        this.currentGameCode = gameCode;
        router.replace('/game', { gameCode });
        this.socket.connect(gameCode, playerName);
      },
      onLogin: () => this.loginModal.show('login'),
      onRegister: () => this.loginModal.show('register'),
    });
  }

  private createLoginPage(): LoginPage {
    return new LoginPage({
      container: this.container,
      onLogin: (_user: User) => {
        router.navigate('/dashboard');
      },
      onSwitchToRegister: () => router.navigate('/register'),
      onBack: () => router.navigate('/'),
    });
  }

  private createRegisterPage(): RegisterPage {
    return new RegisterPage({
      container: this.container,
      onRegister: (_user: User) => {
        router.navigate('/dashboard');
      },
      onSwitchToLogin: () => router.navigate('/login'),
      onBack: () => router.navigate('/'),
    });
  }

  private setupSocketCallbacks(): void {
    this.socket.onStateUpdate((transportState, players, phase, aiEnabled, aiPlayerIndex) => {
      this.currentPlayers = players;
      this.currentPhase = phase;

      if (transportState) {
        this.previousState = this.state;
        this.state = fromTransport(transportState);

        // Detect turn change - play sound if it became my turn
        if (this.previousState && this.previousState.playerTurn !== this.state.playerTurn) {
          const newTurnPlayerIndex = this.state.playerTurn;
          const isAITurn = aiEnabled && newTurnPlayerIndex === aiPlayerIndex;
          if (newTurnPlayerIndex === this.myPlayerIndex && !isAITurn) {
            this.audioManager.playTurnSound();
          }
        }

        this.detectAndAnimateChanges();
        this.inputHandler.setGameState(this.state);
        this.inputState = this.inputHandler.getState();
        this.gameUI.updateFromTransport(transportState, players, phase, aiEnabled, aiPlayerIndex);
      }

      const myIndex = players.indexOf(this.currentPlayerName);
      if (myIndex >= 0) {
        this.myPlayerIndex = myIndex;
        this.inputHandler.setPlayerIndex(myIndex);
        this.gameUI.setPlayerIndex(myIndex);
      }

      // Transition to game view when phase is playing or finished
      if (phase === 'playing' || phase === 'finished') {
        this.showGameView();
      }

      // When both players connected in waiting phase, show game view with Start button
      if (phase === 'waiting' && players.length >= 2) {
        this.showGameView();
      }

      this.render();
      this.startAnimationLoop();
    });

    this.socket.onError((message: string) => {
      this.gameUI.showError(message);
    });

    this.socket.onStatusChange((status: ConnectionStatus) => {
      this.gameUI.setStatus(status);
      this.dashboardUI.setConnectionStatus(status);
      this.isConnected = status === 'connected';
    });

    this.socket.onGameOver((winner: number, winnerName: string) => {
      if (winner === this.myPlayerIndex) {
        this.audioManager.playVictorySound();
      }
      this.gameUI.showGameOver(winner, winnerName);
    });

    this.socket.onPlayerJoined((name: string, _index: number) => {
      this.gameUI.setStatus('connected', `${name} joined the game`);
    });
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => {
      this.starRenderer.resize();
      this.renderer.resize();
      this.render();
    });

    this.canvas.addEventListener('click', (event: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const clickedHex = this.renderer.pixelToHex(x, y);
      if (clickedHex) {
        this.inputHandler.handleClick(clickedHex);
      }
    });

    this.canvas.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      this.inputHandler.cancelSelection();
    });

    window.addEventListener('soundToggle', () => {
      const isMuted = this.audioManager.toggleMute();
      window.dispatchEvent(new CustomEvent('soundStateChanged', { detail: { isMuted } }));
    });

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this.isConnected && this.currentGameCode) return;

      switch (event.key) {
        case 'Escape':
          this.inputHandler.cancelSelection();
          break;
        case 'q':
        case 'Q':
          if (this.inputState.selectedRobot) {
            this.inputHandler.handleTurnClick('left');
          }
          break;
        case 'e':
        case 'E':
          if (this.inputState.selectedRobot) {
            this.inputHandler.handleTurnClick('right');
          }
          break;
        case 'w':
        case 'W':
        case ' ':
          if (this.inputState.selectedRobot) {
            this.inputHandler.handleAdvanceClick();
          }
          break;
        case 'm':
        case 'M':
          const isMuted = this.audioManager.toggleMute();
          window.dispatchEvent(new CustomEvent('soundStateChanged', { detail: { isMuted } }));
          break;
      }
    });
  }

  private registerRoutes(): void {
    registerRoutes([
      {
        path: '/',
        load: () => Promise.resolve({ default: () => this.showLanding() }),
      },
      {
        path: '/login',
        load: () => Promise.resolve({ default: () => this.showLogin() }),
        guards: [requireGuest],
      },
      {
        path: '/register',
        load: () => Promise.resolve({ default: () => this.showRegister() }),
        guards: [requireGuest],
      },
      {
        path: '/dashboard',
        load: () => Promise.resolve({ default: () => this.showDashboard() }),
        guards: [requireAuth],
      },
      {
        path: '/game',
        load: () => Promise.resolve({ default: (params: RouteParams) => this.showGame(params) }),
      },
    ]);
  }

  // Route handlers
  async showLanding(): Promise<void> {
    if (this.currentRoute === '/') return;
    this.currentRoute = '/';
    this.socket.disconnect();

    this.hideAll();
    this.topBar.show();
    this.topBar.setActive('home');
    this.topBar.update();
    this.setupDemoState();
    this.lobbyUI.show();
    this.render();
  }

  async showLogin(): Promise<void> {
    if (this.currentRoute === '/login') return;
    this.currentRoute = '/login';

    this.hideAll();
    this.loginPage.show();
  }

  async showRegister(): Promise<void> {
    if (this.currentRoute === '/register') return;
    this.currentRoute = '/register';

    this.hideAll();
    this.registerPage.show();
  }

  async showDashboard(): Promise<void> {
    if (this.currentRoute === '/dashboard') return;
    this.currentRoute = '/dashboard';
    this.socket.disconnect();
    this.resetGame();

    const authState = authManager.getState();
    if (!authState.isAuthenticated || !authState.user) {
      router.navigate('/login');
      return;
    }

    this.hideAll();
    this.topBar.show();
    this.topBar.setActive('dashboard');
    this.topBar.update();
    await this.dashboardUI.show(authState.user);
  }

  async showGame(params: RouteParams): Promise<void> {
    const gameCode = params.gameCode;
    if (!gameCode) {
      router.navigate('/');
      return;
    }

    if (this.currentRoute === '/game' && this.currentGameCode === gameCode) return;
    this.currentRoute = '/game';
    this.currentGameCode = gameCode;

    const playerName = this.currentPlayerName || getSavedPlayerName() || authManager.getState().user?.username || this.generatePlayerName();
    this.currentPlayerName = playerName;

    this.connectToGame(gameCode, playerName);
  }

  private showGameView(): void {
    this.hideAll();
    // Show and start star background
    this.starRenderer.show();
    this.starRenderer.start();
    this.gameUI.show();
  }

  private hideAll(): void {
    // Hide and stop star background when leaving game view
    this.starRenderer.hide();
    this.starRenderer.stop();
    this.topBar.hide();
    this.lobbyUI.hide();
    this.dashboardUI.hide();
    this.gameUI.hide();
    this.loginPage.hide();
    this.registerPage.hide();
  }

  // Game methods
  private connectToGame(gameCode: string, playerName: string): void {
    this.currentGameCode = gameCode;
    this.currentPlayerName = playerName;
    this.topBar.hide();
    this.dashboardUI.hide();
    this.lobbyUI.hide();
    this.gameUI.setStatus('connecting');
    this.gameUI.show();
    this.socket.connect(gameCode, playerName);
    this.render();
  }

  private generatePlayerName(): string {
    return `Player_${Math.random().toString(36).substring(2, 6)}`;
  }

  private resetGame(): void {
    this.state = createGame(GAME_DEF);
    this.highlights = [];
    this.inputHandler.setGameState(this.state);
    clearMoveHistory();
    this.render();
  }

  private render(): void {
    this.updateHighlights();
    this.renderer.render(this.state, this.highlights);
  }

  private updateHighlights(): void {
    this.highlights = [];

    if (this.inputState.mode === 'select' && this.inputState.selectedRobot) {
      this.highlights.push({
        position: this.inputState.selectedRobot.position,
        type: 'selected',
      });

      if (!this.inputState.selectedRobot.isLockedDown) {
        const dest = {
          q: this.inputState.selectedRobot.position.q + this.inputState.selectedRobot.direction.q,
          r: this.inputState.selectedRobot.position.r + this.inputState.selectedRobot.direction.r,
        };
        const blocked = this.state.robots.some((r) => pairEq(r.position, dest));
        if (!blocked) {
          this.highlights.push({ position: dest, type: 'validMove' });
        }
      }
    } else if (this.inputState.mode === 'selectDirection' && this.inputState.placementPosition) {
      this.highlights.push({
        position: this.inputState.placementPosition,
        type: 'selected',
      });

      const validDirs = this.inputHandler.getValidPlacementDirections();
      for (const dir of validDirs) {
        this.highlights.push({
          position: pairAdd(this.inputState.placementPosition, dir),
          type: 'validMove',
        });
      }
    }

    if (
      this.state.playerTurn === this.myPlayerIndex &&
      this.state.movesThisTurn === this.state.gameDef.movesPerTurn &&
      !this.inputState.selectedRobot
    ) {
      const placementPositions = this.inputHandler.getValidPlacementPositions();
      for (const pos of placementPositions) {
        this.highlights.push({ position: pos, type: 'validMove' });
      }
    }
  }

  private logMove(move: GameMove): void {
    let description = '';
    const playerNameStr = `Player ${move.player + 1}`;

    switch (move.type) {
      case 'place':
        description = `${playerNameStr} placed at (${move.position.q}, ${move.position.r})`;
        break;
      case 'advance':
        description = `${playerNameStr} advanced from (${move.position.q}, ${move.position.r})`;
        break;
      case 'turn':
        description = `${playerNameStr} turned ${move.direction} at (${move.position.q}, ${move.position.r})`;
        break;
    }

    this.gameUI.addMoveToHistory(description);
    logMoveForMCP(description);
  }

  private detectAndAnimateChanges(): void {
    if (!this.previousState) return;

    const prevRobots = this.previousState.robots;
    const currRobots = this.state.robots;

    const prevRobotMap = new Map<string, Robot>();
    for (const r of prevRobots) {
      prevRobotMap.set(pairKey(r.position), r);
    }

    const currRobotMap = new Map<string, Robot>();
    for (const r of currRobots) {
      currRobotMap.set(pairKey(r.position), r);
    }

    // Check for new robots (placement)
    for (const [key, robot] of currRobotMap) {
      if (!prevRobotMap.has(key)) {
        animator.animatePlacement(key, robot.position);
      }
    }

    // Check for removed robots (destruction)
    for (const [key, robot] of prevRobotMap) {
      if (!currRobotMap.has(key)) {
        const color = robot.player === 0 ? 'rgb(0, 212, 255)' : 'rgb(255, 68, 68)';
        animator.animateDestruction(robot.position, color, (q, r) => this.renderer.getPixelFromHex(q, r));
        this.audioManager.playLaserHitSound();
        setTimeout(() => this.audioManager.playRobotDestroyedSound(), 50);
      }
    }

    // Check for robot movement and lock status changes
    for (const robot of currRobots) {
      const key = pairKey(robot.position);
      const prevRobot = prevRobotMap.get(key);

      for (const [prevKey, prevR] of prevRobotMap) {
        if (prevR.player === robot.player && prevKey !== key) {
          const movedFromPrev =
            !currRobotMap.has(prevKey) &&
            pairDist(pairSub(robot.position, prevR.position)) === 1 &&
            pairEq(robot.position, pairAdd(prevR.position, prevR.direction));

          if (movedFromPrev) {
            animator.animateAdvance(prevKey, prevR.position, robot.position);
            this.audioManager.playMoveSound();
            break;
          }
        }
      }

      if (prevRobot && prevRobot !== robot) {
        const prevAngle = Math.atan2(
          Math.sqrt(3) * (prevRobot.direction.r + prevRobot.direction.q * 0.5),
          prevRobot.direction.q * 1.5,
        );
        const currAngle = Math.atan2(
          Math.sqrt(3) * (robot.direction.r + robot.direction.q * 0.5),
          robot.direction.q * 1.5,
        );

        if (Math.abs(prevAngle - currAngle) > 0.1) {
          animator.animateTurn(key, prevAngle, currAngle);
          this.audioManager.playMoveSound();
        }

        if (!prevRobot.isLockedDown && robot.isLockedDown) {
          animator.animateLockFlash(key);
          this.audioManager.playRobotLockedSound();
        }
      }
    }
  }

  private setupDemoState(): void {
    this.state.robots = [
      { position: { q: 0, r: 5 }, direction: CARDINALS[0], isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: -2, r: 5 }, direction: CARDINALS[3], isBeamEnabled: true, isLockedDown: false, player: 0 },
      { position: { q: 2, r: 2 }, direction: CARDINALS[1], isBeamEnabled: false, isLockedDown: false, player: 0 },
      { position: { q: 0, r: -5 }, direction: CARDINALS[3], isBeamEnabled: true, isLockedDown: false, player: 1 },
      { position: { q: 2, r: -5 }, direction: CARDINALS[4], isBeamEnabled: true, isLockedDown: false, player: 1 },
      { position: { q: -1, r: -2 }, direction: CARDINALS[5], isBeamEnabled: false, isLockedDown: true, player: 1 },
    ];
    this.inputHandler.setGameState(this.state);
  }

  private startAnimationLoop(): void {
    let animationFrameId: number | null = null;

    const loop = () => {
      this.render();
      if (animator.isAnimating()) {
        animationFrameId = requestAnimationFrame(loop);
      } else {
        animationFrameId = null;
      }
    };

    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(loop);
    }
  }

  private initWebMCP(): void {
    const context: WebMCPContext = {
      getGameState: () => this.state,
      getPlayerIndex: () => this.myPlayerIndex,
      getPlayers: () => this.currentPlayers,
      getPhase: () => this.currentPhase,
      sendMove: (move: GameMove) => this.socket.sendMove(move),
      requestAI: () => this.socket.requestAI(),
    };
    initWebMCP(context);
  }

  /** Initialize the app and handle initial route */
  async init(): Promise<void> {
    // Subscribe to auth state changes
    authManager.subscribe(async () => {
      this.topBar.update();
      const authState = authManager.getState();
      if (authState.isAuthenticated && authState.user) {
        router.navigate('/dashboard');
      } else {
        router.navigate('/');
      }
    });

    // Try to refresh token first
    await authManager.refreshToken();

    // Handle initial route
    await router.handleRoute();
    this.render();
  }

  /** Expose for debugging */
  getDebugState() {
    return {
      gameState: this.state,
      renderer: this.renderer,
      socket: this.socket,
      inputHandler: this.inputHandler,
      lobbyUI: this.lobbyUI,
      dashboardUI: this.dashboardUI,
      authManager,
    };
  }
}
