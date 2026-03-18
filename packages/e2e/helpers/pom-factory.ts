import { Page, expect, WebSocketRoute } from '@playwright/test';

/**
 * Page Object Model Factory for BoardBots E2E Tests
 *
 * Maps XState knowledge graph events to UI interactions
 * and asserts on application state.
 *
 * This factory bridges the gap between the abstract state machine
 * and the concrete UI implementation.
 *
 * RULE: The UI must satisfy the Graph. The POM maps Graph events to UI.
 * Never modify this to work around UI issues - fix the UI instead.
 */
export class PomFactory {
  private gameWebSocket: WebSocketRoute | null = null;

  constructor(private page: Page) {}

  /**
   * Navigate to the root URL of the application
   */
  async navigateToRoot() {
    // Mock API responses for game creation (allows guest games in tests)
    await this.page.route('**/api/lobby/create', async (route) => {
      console.log('[POM] Intercepted /api/lobby/create request');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ gameCode: 'TESTCD' }),
      });
    });

    // Mock WebSocket for game state
    await this.page.routeWebSocket('**/api/game/**', (ws) => {
      console.log('[POM] WebSocket connection intercepted');
      // Store WebSocket reference for later use
      this.gameWebSocket = ws;

      let gamePhase = 'waiting';
      let players: string[] = [];

      // Initial game state for playing phase
      const initialGameState = {
        robots: [],
        playerTurn: 0,
        movesThisTurn: 3,
        gameDef: {
          board: { hexaBoard: { arenaRadius: 4 } },
          numOfPlayers: 2,
          movesPerTurn: 3,
          robotsPerPlayer: 6,
          winCondition: 'Elimination',
        },
        phase: 'playing',
      };

      ws.onMessage((message) => {
        console.log('[POM] WebSocket message received:', message);

        try {
          const data = JSON.parse(message.toString());

          if (data.type === 'join') {
            // Player joining - use playerName not name
            const playerName = data.playerName || 'Player';
            players.push(playerName);
            // Send back game state (client expects players and phase)
            const gameStateMsg = JSON.stringify({
              type: 'gameState',
              state: null,
              players: players,
              phase: gamePhase,
            });
            console.log('[POM] Sending gameState response:', gameStateMsg);
            ws.send(gameStateMsg);
            // Send playerJoined event
            const joinedMsg = JSON.stringify({
              type: 'playerJoined',
              name: playerName,
              index: players.length - 1,
            });
            console.log('[POM] Sending playerJoined response:', joinedMsg);
            ws.send(joinedMsg);
          }

          if (data.type === 'startGame') {
            // Start the game
            gamePhase = 'playing';
            // Send updated game state WITH actual game state
            const startMsg = JSON.stringify({
              type: 'gameState',
              state: initialGameState,
              players: players,
              phase: gamePhase,
            });
            console.log('[POM] Sending startGame response:', startMsg);
            ws.send(startMsg);
          }

          if (data.type === 'endGame') {
            // Manually trigger game end (for tests that need explicit control)
            if (gamePhase === 'playing') {
              const gameOverMsg = JSON.stringify({
                type: 'gameOver',
                winner: 0,
                winnerName: players[0] || 'Player 1',
              });
              console.log('[POM] Sending gameOver response (manual):', gameOverMsg);
              ws.send(gameOverMsg);
              gamePhase = 'finished';
            }
          }

          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (e) {
          console.log('[POM] Failed to parse WebSocket message:', e);
        }
      });
    });

    // Mock join game API
    await this.page.route('**/api/lobby/join/**', async (route) => {
      console.log('[POM] Intercepted /api/lobby/join request');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock game history for dashboard (matches /api/games?limit=...&offset=...)
    await this.page.route('**/api/games*', async (route) => {
      const url = route.request().url();
      // Only mock the game history list endpoint, not specific game codes
      if (url.includes('/api/games?') || url.endsWith('/api/games')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            games: [],
            pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
          }),
        });
      } else {
        // Let other /api/games/:code routes pass through
        await route.continue();
      }
    });

    // Mock registration API
    await this.page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user-id', username: 'test_user' },
          token: 'mock-jwt-token',
        }),
      });
    });

    // Mock login API
    await this.page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user-id', username: 'test_user' },
          token: 'mock-jwt-token',
        }),
      });
    });

    // Mock auth check
    await this.page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user-id', username: 'test_user' },
        }),
      });
    });

    // Mock token refresh - return 401 to indicate no valid refresh token
    await this.page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No refresh token' }),
      });
    });

    await this.page.addInitScript(() => {
      // Set E2E test flag BEFORE page loads to prevent automatic UI transitions
      (window as unknown as { __E2E_TEST__: boolean }).__E2E_TEST__ = true;
    });

    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Execute an action based on the event name from the knowledge graph
   */
  async executeAction(eventName: string) {
    switch (eventName) {
      // ==========================================
      // AUTHENTICATION EVENTS (from Idle state)
      // ==========================================
      case 'CLICK_LOGIN':
        // From Idle state, click login button to open login modal
        await this.page.locator('[data-testid="btn-login"]').click();
        break;

      case 'CLICK_REGISTER':
        // From Idle state, click register button to open register modal
        await this.page.locator('[data-testid="btn-register"]').click();
        break;

      case 'CLOSE_MODAL':
        // Close any open modal
        await this.page.locator('[data-testid="modal-close"]').click();
        break;

      case 'SWITCH_TO_REGISTER':
        // Switch from login modal to register mode
        await this.page.locator('[data-testid="switch-mode"]').click();
        break;

      case 'SWITCH_TO_LOGIN':
        // Switch from register modal to login mode
        await this.page.locator('[data-testid="switch-mode"]').click();
        break;

      case 'SUBMIT_LOGIN_SUCCESS':
        // Submit login form with valid credentials
        const loginUsername = `test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        await this.page.locator('[data-testid="auth-username"]').fill(loginUsername);
        await this.page.locator('[data-testid="auth-password"]').fill('TestPass123');
        await this.page.locator('[data-testid="submit-btn"]').click();
        // Wait for dashboard to be visible (transition from login modal)
        await this.page.locator('[data-testid="state-dashboard"]').waitFor({ state: 'visible', timeout: 5000 });
        break;

      case 'SUBMIT_LOGIN_FAILED':
        // Submit with invalid credentials
        await this.page.locator('[data-testid="auth-username"]').fill('nonexistent_user');
        await this.page.locator('[data-testid="auth-password"]').fill('WrongPassword123');
        await this.page.locator('[data-testid="submit-btn"]').click();
        break;

      case 'SUBMIT_REGISTER_SUCCESS':
        // Submit registration form with valid data
        const regUsername = `test_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        await this.page.locator('[data-testid="auth-username"]').fill(regUsername);
        await this.page.locator('[data-testid="auth-password"]').fill('TestPass123');
        await this.page.locator('[data-testid="auth-confirm"]').fill('TestPass123');
        await this.page.locator('[data-testid="submit-btn"]').click();
        // Wait for dashboard to be visible (transition from register modal)
        await this.page.locator('[data-testid="state-dashboard"]').waitFor({ state: 'visible', timeout: 5000 });
        break;

      case 'SUBMIT_REGISTER_FAILED':
        // Submit with mismatched passwords
        await this.page.locator('[data-testid="auth-username"]').fill(`test_${Date.now()}`);
        await this.page.locator('[data-testid="auth-password"]').fill('TestPass123');
        await this.page.locator('[data-testid="auth-confirm"]').fill('DifferentPassword');
        await this.page.locator('[data-testid="submit-btn"]').click();
        break;

      case 'LOGOUT':
        // From Dashboard state, click logout
        await this.page.locator('[data-testid="btn-logout"]').click();
        break;

      // ==========================================
      // GAME CREATION/JOINING EVENTS
      // ==========================================
      case 'CREATE_GAME':
        // From Idle or Dashboard, create a new game
        // Use the dashboard's button if dashboard is visible, otherwise use lobby's button
        const dashboardCreateBtn = this.page.locator('[data-testid="state-dashboard"] [data-testid="btn-create-game"]');
        const lobbyCreateBtn = this.page.locator('[data-testid="btn-create-game"]').first();
        if (await dashboardCreateBtn.isVisible()) {
          await dashboardCreateBtn.click();
        } else {
          await lobbyCreateBtn.click();
        }
        // Wait for the waiting screen to be visible (state-waiting on lobby)
        // Use locator('visible=true') to wait for a visible one
        await this.page.locator('[data-testid="state-waiting"]').locator('visible=true').waitFor({ state: 'visible', timeout: 5000 });
        break;

      case 'CLICK_JOIN_GAME':
        // From Idle or Dashboard, click to join a game
        // Use the dashboard's button if dashboard is visible, otherwise use lobby's button
        const dashboardJoinBtn = this.page.locator('[data-testid="state-dashboard"] [data-testid="btn-join-game"]');
        const lobbyJoinBtn = this.page.locator('[data-testid="btn-join-game"]').first();
        if (await dashboardJoinBtn.isVisible()) {
          await dashboardJoinBtn.click();
        } else {
          await lobbyJoinBtn.click();
        }
        // Wait for the joining screen to be visible
        await this.page.locator('[data-testid="state-joining"]').waitFor({ state: 'visible', timeout: 5000 });
        break;

      case 'JOIN_GAME':
        // Enter game code and join - works from both JoiningGame screen and Dashboard inline form
        await this.page.locator('[data-testid="game-code-input"]').first().fill('TESTCD');
        // Try btn-join-now first (lobby's JoiningGame screen), then btn-join-game (Dashboard's inline form)
        const joinNowBtn = this.page.locator('[data-testid="btn-join-now"]');
        const joinGameBtn = this.page.locator('[data-testid="btn-join-game"]').last();
        if (await joinNowBtn.isVisible()) {
          await joinNowBtn.click();
        } else {
          await joinGameBtn.click();
        }
        // Wait for the waiting screen to be visible (either lobbyUI or gameUI)
        // Use evaluateAll to find the visible one (gameUI might have a hidden state-waiting)
        const waitingScreens2 = this.page.locator('[data-testid="state-waiting"]');
        await waitingScreens2.evaluateAll((elements) => {
          const visible = elements.find((el) => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          });
          if (!visible) throw new Error('No visible state-waiting element found');
        });
        break;

      case 'LEAVE_LOBBY':
        // From WaitingForOpponent, leave the lobby
        await this.page.locator('[data-testid="btn-leave-lobby"]').click();
        break;

      case 'START_GAME':
        // From WaitingForOpponent, start the game (host only)
        // Could be on lobbyUI (btn-start-game) or gameUI (btn-start-game-ui)
        const lobbyStartBtn = this.page.locator('[data-testid="btn-start-game"]').first();
        const gameStartBtn = this.page.locator('[data-testid="btn-start-game-ui"]');
        if (await lobbyStartBtn.isVisible()) {
          await lobbyStartBtn.click();
        } else if (await gameStartBtn.isVisible()) {
          await gameStartBtn.click();
        } else {
          // Fallback: try to find any start button
          await this.page.locator('[data-testid="btn-start-game"]').first().click();
        }
        // Wait a moment for the WebSocket response to be processed
        await this.page.waitForTimeout(500);
        break;

      case 'MAKE_MOVE':
        // From InGame, make a move
        await this.page.locator('[data-testid="game-canvas"]').click({ force: true });
        break;

      case 'GAME_ENDED':
        // Wait for the game to actually be playing before ending it to avoid a race condition
        await this.page.locator('[data-testid="state-ingame"]').waitFor({ state: 'visible', timeout: 15000 });
        
        if (this.gameWebSocket) {
          console.log('[POM] Sending gameOver message via WebSocket');
          // Send gameOver directly to the client (we are the mock server here)
          await this.gameWebSocket.send(JSON.stringify({ 
             type: 'gameOver',
             winner: 0,
             winnerName: 'Player 1'
          }));
        }
        // Wait for game over screen
        await this.page.locator('[data-testid="game-over-container"]').waitFor({ state: 'visible', timeout: 30000 });
        break;

      case 'RETURN_TO_HOME':
        // From GameOver, return to Idle/Dashboard
        await this.page.locator('[data-testid="btn-return-home"]').click();
        break;

      default:
        throw new Error(`Unknown event: ${eventName}`);
    }
  }

  /**
   * Assert that the application is in a specific state
   */
  async assertState(stateName: string) {
    switch (stateName) {
      case 'Idle':
        // Home screen - could be Idle landing page (unauthenticated) or Dashboard (authenticated)
        // Check which one is visible using Promise.any to avoid race condition failures
        const idleState = this.page.locator('[data-testid="state-idle"]');
        const dashboardState = this.page.locator('[data-testid="state-dashboard"]');
        
        try {
          // Wait up to 10s for one of them to become visible
          await Promise.any([
            idleState.waitFor({ state: 'visible', timeout: 10000 }),
            dashboardState.waitFor({ state: 'visible', timeout: 10000 })
          ]);
        } catch (e) {
          throw new Error('Expected either state-idle or state-dashboard to become visible');
        }

        const isDashboard = await dashboardState.isVisible();

        if (isDashboard) {
          // Authenticated user on Dashboard
          await expect(dashboardState).toBeVisible();
          await expect(this.page.locator('[data-testid="user-name"]')).toBeVisible();
          await expect(this.page.locator('[data-testid="btn-logout"]')).toBeVisible();
        } else {
           // Unauthenticated user on Idle landing page
          await expect(idleState).toBeVisible();
          await expect(this.page.locator('[data-testid="btn-login"]')).toBeVisible();
          await expect(this.page.locator('[data-testid="btn-register"]')).toBeVisible();
        }
        break;

      case 'LoginModal':
        // Login modal is open
        await expect(this.page.locator('[data-testid="login-modal"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="auth-username"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="auth-password"]')).toBeVisible();
        break;

      case 'RegisterModal':
        // Registration modal is open
        await expect(this.page.locator('[data-testid="login-modal"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="auth-confirm"]')).toBeVisible();
        break;

      case 'Dashboard':
        // Authenticated dashboard
        await expect(this.page.locator('[data-testid="state-dashboard"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="user-name"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="btn-logout"]')).toBeVisible();
        break;

      case 'WaitingForOpponent':
        // Waiting for opponent screen - after joining game, lobby is visible
        // Use .locator(':visible') to find the currently visible element (lobby or gameUI)
        await expect(this.page.locator('[data-testid="state-waiting"]').locator('visible=true')).toBeVisible();
        await expect(this.page.locator('[data-testid="game-code-display"]').locator('visible=true')).toBeVisible();
        break;

      case 'JoiningGame':
        // Join game form
        await expect(this.page.locator('[data-testid="state-joining"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="state-joining"] [data-testid="game-code-input"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="btn-join-now"]')).toBeVisible();
        break;

      case 'InGame':
        // Active gameplay
        await expect(this.page.locator('[data-testid="state-ingame"]')).toBeVisible();
        await expect(this.page.locator('[data-testid="game-canvas"]')).toBeVisible();
        break;

      case 'GameOver':
        // Game over screen
        await expect(this.page.locator('[data-testid="game-over-container"]')).toBeVisible();
        break;

      default:
        throw new Error(`Unknown state: ${stateName}`);
    }
  }
}
