import type { GameState, GameMove, Pair, TransportState } from '@lockitdown/engine';
import { fromTransport, pairKey } from '@lockitdown/engine';
import type { InputState } from './input.js';
import type { ConnectionStatus } from './websocket.js';

export interface GameUIOptions {
  /** Container element for the UI */
  container: HTMLElement;
  /** Called when a move should be executed */
  onMove: (move: GameMove) => void;
  /** Called when AI move is requested */
  onRequestAI: () => void;
  /** Called when start game is requested */
  onStartGame: () => void;
  /** Called when rematch is requested */
  onRematch: () => void;
}

interface PlayerInfo {
  name: string;
  index: number;
  points: number;
  robotsOnBoard: number;
  robotsRemaining: number;
}

export class GameUI {
  private container: HTMLElement;
  private topPanel: HTMLElement;
  private bottomPanel: HTMLElement;
  private statusPanel: HTMLElement;
  private moveLog: HTMLElement;
  private onMoveCallback: (move: GameMove) => void;
  private onRequestAI: () => void;
  private onStartGame: () => void;
  private onRematch: () => void;

  private gameState: GameState | null = null;
  private playerNames: string[] = [];
  private myPlayerIndex: number = 0;
  private phase: string = 'waiting';
  private moveHistory: string[] = [];
  private selectedRobotPosition: Pair | null = null;
  private aiEnabled: boolean = false;
  private aiPlayerIndex?: number;

  constructor(options: GameUIOptions) {
    this.container = options.container;
    this.onMoveCallback = options.onMove;
    this.onRequestAI = options.onRequestAI;
    this.onStartGame = options.onStartGame;
    this.onRematch = options.onRematch;

    // Create UI panels
    this.topPanel = this.createTopPanel();
    this.bottomPanel = this.createBottomPanel();
    this.statusPanel = this.createStatusPanel();
    this.moveLog = this.createMoveLog();

    this.container.appendChild(this.topPanel);
    this.container.appendChild(this.bottomPanel);
    this.container.appendChild(this.statusPanel);
    this.container.appendChild(this.moveLog);

    // Setup sound toggle button
    this.setupSoundToggle();

    this.hide(); // Start hidden
  }

  private createTopPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'ui-panel top-panel';
    panel.innerHTML = `
      <div class="player-info" id="player1-info">
        <div class="player-indicator player-1"></div>
        <span class="player-name">Player 1</span>
        <span class="player-score"></span>
        <span class="player-robots"></span>
      </div>
      <div class="turn-info">
        <span class="current-turn">Turn: Player 1</span>
        <span class="moves-left">Moves: 3</span>
      </div>
      <div class="player-info" id="player2-info">
        <div class="player-indicator player-2"></div>
        <span class="player-name">Player 2</span>
        <span class="player-score"></span>
        <span class="player-robots"></span>
      </div>
      <button id="btn-sound-toggle" class="sound-toggle" title="Toggle Sound">
        <span class="sound-icon">🔊</span>
      </button>
    `;
    return panel;
  }

  private createBottomPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'ui-panel bottom-panel';
    panel.id = 'bottom-panel';

    // Turn controls (shown when playing)
    const turnControls = document.createElement('div');
    turnControls.id = 'turn-controls';
    turnControls.className = 'turn-controls';
    turnControls.innerHTML = `
      <button id="btn-turn-left" class="action-btn" title="Turn Left">
        <span>↶ Turn L</span>
      </button>
      <button id="btn-advance" class="action-btn" title="Advance">
        <span>↑ Advance</span>
      </button>
      <button id="btn-turn-right" class="action-btn" title="Turn Right">
        <span>↷ Turn R</span>
      </button>
      <button id="btn-cancel" class="action-btn danger" title="Cancel">
        <span>Cancel</span>
      </button>
    `;

    // Waiting controls
    const waitingControls = document.createElement('div');
    waitingControls.id = 'waiting-controls';
    waitingControls.className = 'waiting-controls';
    waitingControls.innerHTML = `
      <button id="btn-start" class="primary">Start Game</button>
    `;

    // AI button
    const aiButton = document.createElement('button');
    aiButton.id = 'btn-ai';
    aiButton.className = 'action-btn';
    aiButton.textContent = 'Request AI Move';
    aiButton.style.marginLeft = '12px';

    // Rematch button
    const rematchButton = document.createElement('button');
    rematchButton.id = 'btn-rematch';
    rematchButton.className = 'action-btn';
    rematchButton.textContent = 'Rematch';
    rematchButton.style.display = 'none';

    // Game over panel
    const gameOverPanel = document.createElement('div');
    gameOverPanel.id = 'game-over-panel';
    gameOverPanel.className = 'game-over-panel';
    gameOverPanel.innerHTML = `
      <div class="game-over-message"></div>
    `;
    gameOverPanel.style.display = 'none';

    panel.appendChild(turnControls);
    panel.appendChild(waitingControls);
    panel.appendChild(aiButton);
    panel.appendChild(rematchButton);
    panel.appendChild(gameOverPanel);

    // Set up button handlers
    this.setupButtonHandlers(panel);

    return panel;
  }

  private createStatusPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'ui-panel status-panel';
    panel.id = 'status-panel';
    panel.innerHTML = `
      <div class="status info" id="status-message">Connecting...</div>
    `;
    Object.assign(panel.style, {
      top: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
    });
    return panel;
  }

  private createMoveLog(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'ui-panel move-log';
    panel.id = 'move-log';
    panel.innerHTML = `
      <div class="move-log-header">Move History</div>
      <div class="move-log-entries" id="move-log-entries"></div>
    `;
    Object.assign(panel.style, {
      right: '16px',
      top: '50%',
      transform: 'translateY(-50%)',
      maxHeight: '60vh',
      width: '200px',
      overflow: 'hidden',
    });
    return panel;
  }

  private setupButtonHandlers(panel: HTMLElement): void {
    const btnTurnLeft = panel.querySelector('#btn-turn-left');
    const btnTurnRight = panel.querySelector('#btn-turn-right');
    const btnAdvance = panel.querySelector('#btn-advance');
    const btnCancel = panel.querySelector('#btn-cancel');
    const btnStart = panel.querySelector('#btn-start');
    const btnAI = panel.querySelector('#btn-ai');
    const btnRematch = panel.querySelector('#btn-rematch');

    btnTurnLeft?.addEventListener('click', () => {
      if (!this.selectedRobotPosition) return;
      this.onMoveCallback({ type: 'turn', player: this.myPlayerIndex, position: this.selectedRobotPosition, direction: 'left' });
    });

    btnTurnRight?.addEventListener('click', () => {
      if (!this.selectedRobotPosition) return;
      this.onMoveCallback({ type: 'turn', player: this.myPlayerIndex, position: this.selectedRobotPosition, direction: 'right' });
    });

    btnAdvance?.addEventListener('click', () => {
      if (!this.selectedRobotPosition) return;
      this.onMoveCallback({ type: 'advance', player: this.myPlayerIndex, position: this.selectedRobotPosition });
    });

    btnCancel?.addEventListener('click', () => {
      // Cancel selection - handled by input handler
    });

    btnStart?.addEventListener('click', () => {
      this.onStartGame();
    });

    btnAI?.addEventListener('click', () => {
      this.onRequestAI();
    });

    btnRematch?.addEventListener('click', () => {
      this.onRematch();
    });
  }

  /** Setup sound toggle button in top panel */
  private setupSoundToggle(): void {
    const btnSoundToggle = this.topPanel.querySelector('#btn-sound-toggle');
    const soundIcon = btnSoundToggle?.querySelector('.sound-icon');

    const updateSoundIcon = (isMuted: boolean) => {
      if (soundIcon) {
        soundIcon.textContent = isMuted ? '🔇' : '🔊';
      }
    };

    btnSoundToggle?.addEventListener('click', () => {
      // Dispatch custom event for main.ts to handle
      const event = new CustomEvent('soundToggle');
      window.dispatchEvent(event);
    });

    // Listen for sound state changes
    window.addEventListener('soundStateChanged', ((e: CustomEvent) => {
      updateSoundIcon(e.detail.isMuted);
    }) as EventListener);
  }

  /** Update game state from transport */
  updateFromTransport(transportState: TransportState, players: string[], phase: string, aiEnabled?: boolean, aiPlayerIndex?: number): void {
    this.gameState = fromTransport(transportState);
    this.playerNames = players;
    this.phase = phase;
    this.aiEnabled = aiEnabled ?? false;
    this.aiPlayerIndex = aiPlayerIndex;
    this.render();
  }

  /** Set game state directly */
  setGameState(state: GameState): void {
    this.gameState = state;
    this.render();
  }

  /** Set player index */
  setPlayerIndex(index: number): void {
    this.myPlayerIndex = index;
    this.render();
  }

  /** Set selected robot position for button handlers */
  setSelectedRobotPosition(pos: Pair | null): void {
    this.selectedRobotPosition = pos;
  }

  /** Set connection status */
  setStatus(status: ConnectionStatus, message?: string): void {
    const statusEl = this.statusPanel.querySelector('#status-message');
    if (!statusEl) return;

    statusEl.className = 'status';

    switch (status) {
      case 'connected':
        statusEl.classList.add('info');
        statusEl.textContent = message || 'Connected';
        this.statusPanel.style.display = 'block';
        setTimeout(() => {
          this.statusPanel.style.display = 'none';
        }, 2000);
        break;
      case 'connecting':
        statusEl.classList.add('info');
        statusEl.textContent = 'Connecting...';
        this.statusPanel.style.display = 'block';
        break;
      case 'reconnecting':
        statusEl.classList.add('warning');
        statusEl.textContent = 'Reconnecting...';
        this.statusPanel.style.display = 'block';
        break;
      case 'disconnected':
        statusEl.classList.add('error');
        statusEl.textContent = message || 'Disconnected';
        this.statusPanel.style.display = 'block';
        break;
    }
  }

  /** Show error message */
  showError(message: string): void {
    const statusEl = this.statusPanel.querySelector('#status-message');
    if (statusEl) {
      statusEl.className = 'status error';
      statusEl.textContent = message;
      this.statusPanel.style.display = 'block';
      setTimeout(() => {
        this.statusPanel.style.display = 'none';
      }, 3000);
    }
  }

  /** Update input state for button visibility */
  updateInputState(inputState: InputState, selectedPosition: Pair | null): void {
    const turnControls = this.bottomPanel.querySelector('#turn-controls');
    if (!turnControls) return;

    // Update button states based on selection
    const btnTurnLeft = turnControls.querySelector('#btn-turn-left');
    const btnTurnRight = turnControls.querySelector('#btn-turn-right');
    const btnAdvance = turnControls.querySelector('#btn-advance');
    const btnCancel = turnControls.querySelector('#btn-cancel');

    if (inputState.selectedRobot && selectedPosition) {
      // Enable turn buttons
      (btnTurnLeft as HTMLButtonElement).disabled = false;
      (btnTurnRight as HTMLButtonElement).disabled = false;

      // Enable advance if not locked and destination empty
      const canAdvance = !inputState.selectedRobot.isLockedDown && inputState.validMoves.some(
        (m) => m.type === 'advance' && pairKey(m.position) === pairKey(selectedPosition)
      );
      (btnAdvance as HTMLButtonElement).disabled = !canAdvance;

      // Show cancel
      (btnCancel as HTMLElement).style.display = 'inline-block';
    } else {
      // Disable action buttons when nothing selected
      (btnTurnLeft as HTMLButtonElement).disabled = true;
      (btnTurnRight as HTMLButtonElement).disabled = true;
      (btnAdvance as HTMLButtonElement).disabled = true;
      (btnCancel as HTMLElement).style.display = 'none';
    }
  }

  /** Add move to history */
  addMoveToHistory(moveDescription: string): void {
    this.moveHistory.push(moveDescription);
    this.renderMoveLog();
  }

  /** Show game over */
  showGameOver(winner: number, winnerName: string): void {
    const isWinner = winner === this.myPlayerIndex;

    // Create full-screen victory overlay
    const overlay = document.createElement('div');
    overlay.id = 'victory-overlay';
    overlay.className = 'victory-overlay';
    overlay.innerHTML = `
      <div class="victory-hex-pattern"></div>
      <div class="victory-content">
        <h1 class="victory-title ${isWinner ? 'winner' : 'loser'}">
          ${isWinner ? 'Victory!' : 'Defeat'}
        </h1>
        <p class="victory-subtitle">
          ${isWinner ? 'Congratulations!' : `${winnerName} Wins!`}
        </p>
        <div class="victory-buttons">
          <button id="victory-rematch" class="primary">Rematch</button>
          <button id="victory-new-game">New Game</button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    // Add button handlers
    const rematchBtn = overlay.querySelector('#victory-rematch');
    const newGameBtn = overlay.querySelector('#victory-new-game');

    rematchBtn?.addEventListener('click', () => {
      this.hideGameOver();
      this.onRematch();
    });

    newGameBtn?.addEventListener('click', () => {
      this.hideGameOver();
      window.history.pushState({}, '', window.location.pathname);
      window.location.reload();
    });

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }

  /** Hide game over panel */
  hideGameOver(): void {
    const overlay = this.container.querySelector('#victory-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }

    const btnRematch = this.bottomPanel.querySelector('#btn-rematch') as HTMLButtonElement;
    if (btnRematch) {
      btnRematch.style.display = 'none';
    }
  }

  /** Show the UI */
  show(): void {
    this.topPanel.style.display = 'flex';
    this.bottomPanel.style.display = 'flex';
    this.moveLog.style.display = 'block';
  }

  /** Hide the UI */
  hide(): void {
    this.topPanel.style.display = 'none';
    this.bottomPanel.style.display = 'none';
    this.moveLog.style.display = 'none';
    this.statusPanel.style.display = 'none';
  }

  /** Render current state */
  private render(): void {
    if (!this.gameState) return;

    this.renderPlayerInfo();
    this.renderTurnInfo();
    this.renderPhaseControls();
    this.renderMoveLog();
  }

  private renderPlayerInfo(): void {
    if (!this.gameState) return;

    const players = this.getPlayerInfos();

    for (let i = 0; i < players.length; i++) {
      const info = players[i];
      const playerEl = this.topPanel.querySelector(`#player${i + 1}-info`);
      if (!playerEl) continue;

      const nameEl = playerEl.querySelector('.player-name');
      const scoreEl = playerEl.querySelector('.player-score');
      const robotsEl = playerEl.querySelector('.player-robots');

      if (nameEl) nameEl.textContent = info.name || `Player ${i + 1}`;
      if (scoreEl) scoreEl.textContent = `(${info.points} pts)`;
      if (robotsEl) robotsEl.textContent = `Robots: ${info.robotsOnBoard} (${info.robotsRemaining} reserve)`;

      // Highlight active player and show AI indicator
      const isActive = this.gameState.playerTurn === i;
      const isAI = this.aiEnabled && i === this.aiPlayerIndex;
      playerEl.classList.toggle('active-player', isActive);
      playerEl.classList.toggle('ai-player', isAI);

      // Show AI badge
      let aiBadge = playerEl.querySelector('.ai-badge');
      if (isAI && !aiBadge) {
        aiBadge = document.createElement('span');
        aiBadge.className = 'ai-badge';
        aiBadge.textContent = '🤖 AI';
        playerEl.appendChild(aiBadge);
      } else if (!isAI && aiBadge) {
        aiBadge.remove();
      }
    }
  }

  private renderTurnInfo(): void {
    if (!this.gameState) return;

    const turnEl = this.topPanel.querySelector('.current-turn');
    const movesEl = this.topPanel.querySelector('.moves-left');

    const currentPlayerName = this.playerNames[this.gameState.playerTurn] || `Player ${this.gameState.playerTurn + 1}`;
    const isMyTurn = this.gameState.playerTurn === this.myPlayerIndex;

    if (turnEl) {
      turnEl.textContent = isMyTurn ? 'Your Turn' : `${currentPlayerName}'s Turn`;
    }
    if (movesEl) {
      movesEl.textContent = `Moves: ${this.gameState.movesThisTurn}`;
    }
  }

  private renderPhaseControls(): void {
    const turnControls = this.bottomPanel.querySelector('#turn-controls');
    const waitingControls = this.bottomPanel.querySelector('#waiting-controls');
    const btnAI = this.bottomPanel.querySelector('#btn-ai') as HTMLButtonElement;
    const btnStart = this.bottomPanel.querySelector('#btn-start') as HTMLButtonElement;

    switch (this.phase) {
      case 'waiting':
        if (turnControls) (turnControls as HTMLElement).style.display = 'none';
        if (waitingControls) (waitingControls as HTMLElement).style.display = 'flex';
        if (btnAI) btnAI.style.display = 'none';
        // Only host can start, or AI game starts immediately
        if (btnStart) {
          // Disable start button for AI games (they auto-start)
          btnStart.disabled = this.aiEnabled || this.playerNames.length < 2;
          if (this.aiEnabled) {
            btnStart.style.display = 'none';
          } else {
            btnStart.style.display = 'inline-block';
          }
        }
        break;
      case 'playing':
        if (turnControls) (turnControls as HTMLElement).style.display = 'flex';
        if (waitingControls) (waitingControls as HTMLElement).style.display = 'none';
        if (btnAI) {
          // Hide AI button in AI games (moves are automatic)
          btnAI.style.display = this.aiEnabled ? 'none' : 'inline-block';
          if (!this.aiEnabled) {
            btnAI.disabled = !this.gameState || this.gameState.playerTurn !== this.myPlayerIndex;
          }
        }
        break;
      case 'finished':
        if (turnControls) (turnControls as HTMLElement).style.display = 'none';
        if (waitingControls) (waitingControls as HTMLElement).style.display = 'none';
        if (btnAI) btnAI.style.display = 'none';
        break;
    }
  }

  private renderMoveLog(): void {
    const entriesEl = this.moveLog.querySelector('#move-log-entries');
    if (!entriesEl) return;

    entriesEl.innerHTML = this.moveHistory
      .slice(-20) // Last 20 moves
      .map((move, i) => `<div class="move-entry">${this.moveHistory.length - this.moveHistory.slice(-20).length + i + 1}. ${move}</div>`)
      .join('');

    // Scroll to bottom
    entriesEl.scrollTop = entriesEl.scrollHeight;
  }

  private getPlayerInfos(): PlayerInfo[] {
    if (!this.gameState) return [];

    const infos: PlayerInfo[] = [];

    for (let i = 0; i < this.gameState.players.length; i++) {
      const player = this.gameState.players[i];
      const robotsOnBoard = this.gameState.robots.filter((r) => r.player === i).length;

      infos.push({
        name: this.playerNames[i] || `Player ${i + 1}`,
        index: i,
        points: player.points,
        robotsOnBoard,
        robotsRemaining: this.gameState.gameDef.robotsPerPlayer - player.placedRobots,
      });
    }

    return infos;
  }
}
