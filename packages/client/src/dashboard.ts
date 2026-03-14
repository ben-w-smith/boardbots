/**
 * Dashboard UI - Logged-in user dashboard with game history and quick actions
 */

import { authManager, type User } from './auth.js';
import {
  getGameHistory,
  formatRelativeTime,
  getOpponentName,
  getGameResult,
  type GameHistoryItem,
  type GameHistoryResponse,
} from './api/games.js';
import type { ConnectionStatus } from './websocket.js';

export interface DashboardOptions {
  container: HTMLElement;
  onCreateGame: (playerName: string) => Promise<string | null>;
  onCreateAIGame?: (playerName: string, aiDepth: number) => Promise<string | null>;
  onJoinGame: (gameCode: string, playerName: string) => void;
  onLogout: () => void;
}

export interface DashboardState {
  user: User;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
  };
  games: GameHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
}

export class DashboardUI {
  private container: HTMLElement;
  private dashboardEl: HTMLElement;
  private onCreateGame: (playerName: string) => Promise<string | null>;
  private onCreateAIGame?: (playerName: string, aiDepth: number) => Promise<string | null>;
  private onJoinGame: (gameCode: string, playerName: string) => void;
  private onLogout: () => void;

  private state: DashboardState | null = null;
  private aiDepth: number = 3;
  private joinGameCode: string = '';

  constructor(options: DashboardOptions) {
    this.container = options.container;
    this.onCreateGame = options.onCreateGame;
    this.onCreateAIGame = options.onCreateAIGame;
    this.onJoinGame = options.onJoinGame;
    this.onLogout = options.onLogout;

    // Create dashboard container
    this.dashboardEl = document.createElement('div');
    this.dashboardEl.className = 'dashboard-container';
    this.dashboardEl.style.display = 'none';
    this.container.appendChild(this.dashboardEl);
  }

  /** Show the dashboard for a user */
  async show(user: User): Promise<void> {
    this.dashboardEl.style.display = 'flex';
    await this.loadDashboardData(user);
  }

  /** Hide the dashboard */
  hide(): void {
    this.dashboardEl.style.display = 'none';
  }

  /** Update connection status indicator */
  setConnectionStatus(status: ConnectionStatus): void {
    if (this.state) {
      this.state.connectionStatus = status;
      this.updateConnectionStatusElement();
    }
  }

  /** Load dashboard data from API */
  private async loadDashboardData(user: User): Promise<void> {
    this.state = {
      user,
      stats: { gamesPlayed: 0, wins: 0, losses: 0 },
      games: [],
      pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      connectionStatus: 'disconnected',
      isLoading: true,
    };

    this.render();

    try {
      const response: GameHistoryResponse = await getGameHistory(20, 0);
      if (this.state) {
        this.state.games = response.games;
        this.state.pagination = response.pagination;
        // Calculate stats from games
        this.state.stats.gamesPlayed = response.pagination.total;
        this.state.stats.wins = response.games.filter(
          (g) => g.winnerId === user.id && g.phase === 'finished'
        ).length;
        this.state.stats.losses = response.games.filter(
          (g) => g.winnerId !== user.id && g.winnerId !== null && g.phase === 'finished'
        ).length;
        this.state.isLoading = false;
        this.render();
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      if (this.state) {
        this.state.isLoading = false;
        this.render();
      }
    }
  }

  /** Load more games (pagination) */
  private async loadMoreGames(): Promise<void> {
    if (!this.state || !this.state.pagination.hasMore) return;

    try {
      const newOffset = this.state.pagination.offset + this.state.pagination.limit;
      const response = await getGameHistory(this.state.pagination.limit, newOffset);

      if (this.state) {
        this.state.games = [...this.state.games, ...response.games];
        this.state.pagination = response.pagination;
        this.renderGameList();
      }
    } catch (error) {
      console.error('Failed to load more games:', error);
    }
  }

  /** Render the full dashboard */
  private render(): void {
    if (!this.state) return;

    this.dashboardEl.innerHTML = `
      <aside class="profile-sidebar">
        ${this.renderProfileSection()}
        ${this.renderStatsSection()}
        ${this.renderQuickActions()}
      </aside>
      <main class="game-list-container">
        ${this.renderGameList()}
      </main>
    `;

    this.setupEventHandlers();
  }

  /** Render user profile section */
  private renderProfileSection(): string {
    if (!this.state) return '';
    const { user } = this.state;
    const initial = user.username.charAt(0).toUpperCase();

    return `
      <div class="user-profile">
        <div class="user-avatar">${initial}</div>
        <h2 class="user-name">${this.escapeHtml(user.username)}</h2>
        ${this.getConnectionStatusHtml()}
      </div>
    `;
  }

  /** Get connection status HTML string */
  private getConnectionStatusHtml(): string {
    if (!this.state) return '';

    const statusConfig: Record<ConnectionStatus, { class: string; text: string }> = {
      connected: { class: 'connected', text: 'Online' },
      connecting: { class: 'connecting', text: 'Connecting...' },
      reconnecting: { class: 'reconnecting', text: 'Reconnecting...' },
      disconnected: { class: 'disconnected', text: 'Offline' },
    };

    const config = statusConfig[this.state.connectionStatus];
    return `
      <div class="online-status">
        <span class="status-dot ${config.class}"></span>
        <span class="status-text">${config.text}</span>
      </div>
    `;
  }

  /** Update only the connection status element in DOM */
  private updateConnectionStatusElement(): void {
    const statusEl = this.dashboardEl.querySelector('.online-status');
    if (statusEl && this.state) {
      statusEl.outerHTML = this.getConnectionStatusHtml();
    }
  }

  /** Render stats section */
  private renderStatsSection(): string {
    if (!this.state) return '';

    const { stats } = this.state;
    const winRate = stats.gamesPlayed > 0
      ? Math.round((stats.wins / stats.gamesPlayed) * 100)
      : 0;

    return `
      <div class="user-stats">
        <div class="stat-item">
          <div class="stat-value">${stats.gamesPlayed}</div>
          <div class="stat-label">Games</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${winRate}%</div>
          <div class="stat-label">Win Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.wins}</div>
          <div class="stat-label">Wins</div>
        </div>
      </div>
    `;
  }

  /** Render quick actions section */
  private renderQuickActions(): string {
    const aiButton = this.onCreateAIGame
      ? `<button class="action-btn secondary" id="dashboard-btn-vs-ai">Play vs AI</button>`
      : '';

    return `
      <div class="quick-actions">
        <button class="action-btn primary" id="dashboard-btn-create">Create Game</button>
        ${aiButton}
        <div class="join-game-form">
          <input
            type="text"
            class="join-game-input"
            placeholder="Enter game code"
            maxlength="6"
            id="dashboard-join-code"
          />
          <button class="action-btn" id="dashboard-btn-join">Join</button>
        </div>
        ${this.renderDifficultySelector()}
        <button class="action-btn danger" id="dashboard-btn-logout">Logout</button>
      </div>
    `;
  }

  /** Render difficulty selector */
  private renderDifficultySelector(): string {
    if (!this.onCreateAIGame) return '';

    return `
      <div class="difficulty-selector dashboard-difficulty">
        <button class="difficulty-btn ${this.aiDepth === 2 ? 'active' : ''}" data-depth="2">Easy</button>
        <button class="difficulty-btn ${this.aiDepth === 3 ? 'active' : ''}" data-depth="3">Medium</button>
        <button class="difficulty-btn ${this.aiDepth === 4 ? 'active' : ''}" data-depth="4">Hard</button>
      </div>
    `;
  }

  /** Render game list section */
  private renderGameList(): string {
    if (!this.state) return '';

    const { games, isLoading, pagination } = this.state;

    if (isLoading) {
      return `
        <div class="game-list-header">
          <h3>Game History</h3>
        </div>
        <div class="game-list-loading">
          <div class="loading-spinner"></div>
          <span>Loading games...</span>
        </div>
      `;
    }

    if (games.length === 0) {
      return `
        <div class="game-list-header">
          <h3>Game History</h3>
        </div>
        <div class="game-list-empty">
          <p>No games played yet.</p>
          <p>Create a game to get started!</p>
        </div>
      `;
    }

    // Separate active and finished games
    const activeGames = games.filter((g) => g.phase !== 'finished');
    const finishedGames = games.filter((g) => g.phase === 'finished');

    let html = '';

    // Active games section
    if (activeGames.length > 0) {
      html += `
        <div class="game-list-header">
          <h3>Active Games</h3>
          <span class="game-count">${activeGames.length}</span>
        </div>
        <div class="game-cards active-games">
          ${activeGames.map((g) => this.renderGameCard(g)).join('')}
        </div>
      `;
    }

    // Game history section
    html += `
      <div class="game-list-header">
        <h3>Game History</h3>
        <span class="game-count">${pagination.total}</span>
      </div>
      <div class="game-cards finished-games">
        ${finishedGames.map((g) => this.renderGameCard(g)).join('')}
      </div>
    `;

    // Load more button
    if (pagination.hasMore) {
      html += `
        <div class="load-more">
          <button class="action-btn secondary" id="dashboard-load-more">Load More</button>
        </div>
      `;
    }

    return html;
  }

  /** Render a single game card */
  private renderGameCard(game: GameHistoryItem): string {
    if (!this.state) return '';

    const opponent = getOpponentName(game.players, this.state.user.username);
    const result = getGameResult(game.winnerId, this.state.user.id, game.phase);
    const isActive = result === 'in_progress';
    const timeAgo = formatRelativeTime(game.createdAt);

    const resultClass = result === 'win' ? 'won' : result === 'loss' ? 'lost' : '';
    const resultText = result === 'win' ? 'Won' : result === 'loss' ? 'Lost' : result === 'draw' ? 'Draw' : '';
    const actionText = isActive ? 'Resume' : 'View';

    return `
      <div class="game-card ${isActive ? 'active' : ''} ${resultClass}" data-game-code="${game.gameCode}">
        <div class="game-card-info">
          <div class="game-card-header">
            <span class="opponent-name">${this.escapeHtml(opponent)}</span>
            ${!isActive ? `<span class="result-badge ${resultClass}">${resultText}</span>` : ''}
            ${game.aiEnabled ? '<span class="ai-badge">AI</span>' : ''}
          </div>
          <div class="game-card-meta">
            <span class="timestamp">${timeAgo}</span>
          </div>
        </div>
        <button class="game-action-btn" data-game-code="${game.gameCode}">
          ${actionText}
        </button>
      </div>
    `;
  }

  /** Set up event handlers */
  private setupEventHandlers(): void {
    // Create game button
    const btnCreate = this.dashboardEl.querySelector('#dashboard-btn-create');
    btnCreate?.addEventListener('click', () => this.handleCreateGame());

    // Play vs AI button
    const btnVsAI = this.dashboardEl.querySelector('#dashboard-btn-vs-ai');
    btnVsAI?.addEventListener('click', () => this.handleCreateAIGame());

    // Join game
    const btnJoin = this.dashboardEl.querySelector('#dashboard-btn-join');
    const joinInput = this.dashboardEl.querySelector('#dashboard-join-code') as HTMLInputElement;
    btnJoin?.addEventListener('click', () => this.handleJoinGame());
    joinInput?.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter') {
        this.handleJoinGame();
      }
    });
    joinInput?.addEventListener('input', () => {
      this.joinGameCode = joinInput.value.toUpperCase();
    });

    // Difficulty selector
    const difficultyBtns = this.dashboardEl.querySelectorAll('.difficulty-btn');
    difficultyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const depth = parseInt((btn as HTMLElement).dataset.depth || '3', 10);
        this.aiDepth = depth;
        difficultyBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Logout button
    const btnLogout = this.dashboardEl.querySelector('#dashboard-btn-logout');
    btnLogout?.addEventListener('click', () => this.handleLogout());

    // Game cards
    const gameCards = this.dashboardEl.querySelectorAll('.game-action-btn');
    gameCards.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const gameCode = (e.currentTarget as HTMLElement).dataset.gameCode;
        if (gameCode) {
          this.handleGameAction(gameCode);
        }
      });
    });

    // Load more button
    const btnLoadMore = this.dashboardEl.querySelector('#dashboard-load-more');
    btnLoadMore?.addEventListener('click', () => this.loadMoreGames());
  }

  /** Handle create game click */
  private async handleCreateGame(): Promise<void> {
    if (!this.state) return;
    const btn = this.dashboardEl.querySelector('#dashboard-btn-create') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating...';
    }

    try {
      await this.onCreateGame(this.state.user.username);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create Game';
      }
    }
  }

  /** Handle create AI game click */
  private async handleCreateAIGame(): Promise<void> {
    if (!this.state || !this.onCreateAIGame) return;
    const btn = this.dashboardEl.querySelector('#dashboard-btn-vs-ai') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating...';
    }

    try {
      await this.onCreateAIGame(this.state.user.username, this.aiDepth);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Play vs AI';
      }
    }
  }

  /** Handle join game click */
  private handleJoinGame(): void {
    if (!this.state || !this.joinGameCode) return;

    const code = this.joinGameCode.toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      this.showError('Invalid game code');
      return;
    }

    this.onJoinGame(code, this.state.user.username);
  }

  /** Handle game action (view/resume) */
  private handleGameAction(gameCode: string): void {
    if (!this.state) return;
    // Navigate to the game
    window.history.pushState({}, '', `?game=${gameCode}`);
    this.onJoinGame(gameCode, this.state.user.username);
  }

  /** Handle logout */
  private handleLogout(): void {
    authManager.logout();
    this.hide();
    this.onLogout();
  }

  /** Show error message */
  private showError(message: string): void {
    // For now, use alert. Could be replaced with a toast notification.
    alert(message);
  }

  /** Escape HTML for safe rendering */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
