/**
 * Dashboard UI - Logged-in user dashboard with game history and quick actions
 */

import { authManager, type User } from './auth.js';
import {
  getGameHistory,
  formatRelativeTime,
  getOpponentName,
  getGameResult,
  cancelGame,
  archiveGame,
  unarchiveGame,
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
        this.state.games = []; // Ensure empty array, not stale data
        this.render();
        this.showError('Failed to load game history. Please try again.');
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
      </div>
    `;
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
        <div class="stat-item">
          <div class="stat-value">${stats.losses}</div>
          <div class="stat-label">Losses</div>
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
        <button class="action-btn primary" id="dashboard-btn-create">New Game</button>
        ${aiButton}
        <div class="join-game-form">
          <input
            type="text"
            class="join-game-input"
            placeholder="Enter game code"
            maxlength="6"
            id="dashboard-join-code"
          />
          <button class="action-btn tertiary" id="dashboard-btn-join">Join</button>
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

    // Separate games by status and phase
    // Handle missing status field gracefully - treat undefined as 'active'
    const activeGames = games.filter((g) => (g.status === 'active' || !g.status) && g.phase !== 'finished');
    const cancelledGames = games.filter((g) => g.status === 'cancelled');
    const completedGames = games.filter((g) => (g.status === 'completed' || g.status === 'active') && g.phase === 'finished');
    const archivedGames = games.filter((g) => g.status === 'archived');

    let html = '';

    // Active games section
    if (activeGames.length > 0) {
      html += `
        <div class="game-list-header">
          <h3>Active Games</h3>
          <span class="game-count">${activeGames.length}</span>
        </div>
        <div class="game-cards active-games">
          ${activeGames.map((g) => this.renderGameCard(g, true)).join('')}
        </div>
      `;
    }

    // Cancelled games section
    if (cancelledGames.length > 0) {
      html += `
        <div class="game-list-header">
          <h3>Cancelled Games</h3>
          <span class="game-count">${cancelledGames.length}</span>
        </div>
        <div class="game-cards cancelled-games">
          ${cancelledGames.map((g) => this.renderGameCard(g, false, true)).join('')}
        </div>
      `;
    }

    // Completed games section
    if (completedGames.length > 0) {
      html += `
        <div class="game-list-header">
          <h3>Completed Games</h3>
          <span class="game-count">${completedGames.length}</span>
        </div>
        <div class="game-cards finished-games">
          ${completedGames.map((g) => this.renderGameCard(g)).join('')}
        </div>
      `;
    }

    // Archived games section
    if (archivedGames.length > 0) {
      html += `
        <div class="game-list-header">
          <h3>Archived Games</h3>
          <span class="game-count">${archivedGames.length}</span>
        </div>
        <div class="game-cards archived-games">
          ${archivedGames.map((g) => this.renderGameCard(g, false, false, true)).join('')}
        </div>
      `;
    }

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
  private renderGameCard(
    game: GameHistoryItem,
    showCancelButton: boolean = false,
    showCancelledBadge: boolean = false,
    showUnarchiveButton: boolean = false
  ): string {
    if (!this.state) return '';

    const opponent = getOpponentName(game.players, this.state.user.username);
    const result = getGameResult(game.winnerId, this.state.user.id, game.phase);
    const isActive = result === 'in_progress' && game.status === 'active';
    const isCancelled = game.status === 'cancelled';
    const isArchived = game.status === 'archived';
    const timeAgo = formatRelativeTime(game.createdAt);

    let resultClass = result === 'win' ? 'won' : result === 'loss' ? 'lost' : '';
    let resultText = result === 'win' ? 'Won' : result === 'loss' ? 'Lost' : result === 'draw' ? 'Draw' : '';

    if (isCancelled) {
      resultClass = 'cancelled';
      resultText = 'Cancelled';
    }

    const actionText = isActive ? 'Resume' : 'View';

    // Build action buttons
    let actionButtons = '';
    if (showCancelButton) {
      actionButtons = `
        <div class="game-card-actions">
          <button class="game-action-btn primary" data-game-code="${game.gameCode}" data-action="resume">
            ${actionText}
          </button>
          <button class="game-action-btn danger" data-game-code="${game.gameCode}" data-action="cancel">
            Cancel
          </button>
        </div>
      `;
    } else if (showUnarchiveButton) {
      actionButtons = `
        <div class="game-card-actions">
          <button class="game-action-btn" data-game-code="${game.gameCode}" data-action="view">
            View
          </button>
          <button class="game-action-btn secondary" data-game-code="${game.gameCode}" data-action="unarchive">
            Restore
          </button>
        </div>
      `;
    } else if (showCancelledBadge) {
      actionButtons = `
        <div class="game-card-actions">
          <button class="game-action-btn" data-game-code="${game.gameCode}" data-action="view">
            View
          </button>
          <button class="game-action-btn secondary" data-game-code="${game.gameCode}" data-action="archive">
            Archive
          </button>
        </div>
      `;
    } else if (game.phase === 'finished' && !isArchived) {
      actionButtons = `
        <div class="game-card-actions">
          <button class="game-action-btn" data-game-code="${game.gameCode}" data-action="view">
            View
          </button>
          <button class="game-action-btn secondary" data-game-code="${game.gameCode}" data-action="archive">
            Archive
          </button>
        </div>
      `;
    } else {
      actionButtons = `
        <button class="game-action-btn" data-game-code="${game.gameCode}" data-action="view">
          ${actionText}
        </button>
      `;
    }

    return `
      <div class="game-card ${isActive ? 'active' : ''} ${isArchived ? 'archived' : ''} ${resultClass}" data-game-code="${game.gameCode}">
        <div class="game-card-info">
          <div class="game-card-header">
            <span class="opponent-name">${this.escapeHtml(opponent)}</span>
            ${resultText ? `<span class="result-badge ${resultClass}">${resultText}</span>` : ''}
            ${game.aiEnabled ? '<span class="ai-badge">AI</span>' : ''}
            ${isArchived ? '<span class="archived-badge">Archived</span>' : ''}
          </div>
          <div class="game-card-meta">
            <span class="timestamp">${timeAgo}</span>
          </div>
        </div>
        ${actionButtons}
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
        const action = (e.currentTarget as HTMLElement).dataset.action || 'view';
        if (gameCode) {
          this.handleGameAction(gameCode, action);
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

  /** Handle game action (view/resume/cancel/archive/unarchive) */
  private async handleGameAction(gameCode: string, action: string): Promise<void> {
    if (!this.state) return;

    switch (action) {
      case 'cancel':
        await this.handleCancelGame(gameCode);
        break;
      case 'archive':
        await this.handleArchiveGame(gameCode);
        break;
      case 'unarchive':
        await this.handleUnarchiveGame(gameCode);
        break;
      case 'view':
      case 'resume':
      default:
        // Navigate to the game
        window.history.pushState({}, '', `?game=${gameCode}`);
        this.onJoinGame(gameCode, this.state.user.username);
        break;
    }
  }

  /** Handle cancel game */
  private async handleCancelGame(gameCode: string): Promise<void> {
    if (!this.state) return;

    const confirmed = confirm('Are you sure you want to cancel this game? This cannot be undone.');
    if (!confirmed) return;

    try {
      await cancelGame(gameCode);
      // Reload dashboard data to reflect the change
      await this.loadDashboardData(this.state.user);
    } catch (error) {
      console.error('Failed to cancel game:', error);
      this.showError('Failed to cancel game. Please try again.');
    }
  }

  /** Handle archive game */
  private async handleArchiveGame(gameCode: string): Promise<void> {
    if (!this.state) return;

    try {
      await archiveGame(gameCode);
      // Reload dashboard data to reflect the change
      await this.loadDashboardData(this.state.user);
    } catch (error) {
      console.error('Failed to archive game:', error);
      this.showError('Failed to archive game. Please try again.');
    }
  }

  /** Handle unarchive game */
  private async handleUnarchiveGame(gameCode: string): Promise<void> {
    if (!this.state) return;

    try {
      await unarchiveGame(gameCode);
      // Reload dashboard data to reflect the change
      await this.loadDashboardData(this.state.user);
    } catch (error) {
      console.error('Failed to unarchive game:', error);
      this.showError('Failed to restore game. Please try again.');
    }
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
