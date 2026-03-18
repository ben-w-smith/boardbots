import { setup, assign } from 'xstate';

/**
 * THE KNOWLEDGE GRAPH - BoardBots User Journey State Machine
 *
 * This file is the single source of truth for all user journeys in the BoardBots app.
 * It defines what states the user can be in, and what actions they can take to move between them.
 *
 * Playwright tests are auto-generated from this machine.
 * The frontend UI is written explicitly to satisfy those tests.
 *
 * == IDENTIFIED STATES ==
 * - Idle: Landing page, user can login, register, create game, or join game
 * - LoginModal: Login modal is open
 * - RegisterModal: Registration modal is open
 * - Dashboard: Authenticated user dashboard
 * - WaitingForOpponent: Host created game, waiting for opponent
 * - JoiningGame: Guest is entering game code to join
 * - InGame: Actively playing a game
 * - GameOver: Game has concluded
 *
 * == EVENT NAMING CONVENTION ==
 * Events are named in ALL_CAPS and semantically describe a user action.
 */

export const boardBotsMachine = setup({
  types: {} as {
    context: {
      // User context
      userId: string | null;
      username: string | null;
      token: string | null;

      // Game context
      gameCode: string | null;
      isHost: boolean;
      gameId: string | null;
      currentTurn: number;
      winner: string | null;
    };
    events:
      | { type: 'CLICK_LOGIN' }
      | { type: 'CLICK_REGISTER' }
      | { type: 'CLOSE_MODAL' }
      | { type: 'SWITCH_TO_REGISTER' }
      | { type: 'SWITCH_TO_LOGIN' }
      | { type: 'SUBMIT_LOGIN_SUCCESS'; userId: string; username: string; token: string }
      | { type: 'SUBMIT_LOGIN_FAILED'; error: string }
      | { type: 'SUBMIT_REGISTER_SUCCESS'; userId: string; username: string; token: string }
      | { type: 'SUBMIT_REGISTER_FAILED'; error: string }
      | { type: 'LOGOUT' }
      | { type: 'CREATE_GAME'; gameCode: string }
      | { type: 'CLICK_JOIN_GAME' }
      | { type: 'JOIN_GAME'; gameCode: string }
      | { type: 'LEAVE_LOBBY' }
      | { type: 'START_GAME'; gameId: string }
      | { type: 'MAKE_MOVE'; position: { row: number; col: number } }
      | { type: 'GAME_ENDED'; winner: string }
      | { type: 'RETURN_TO_HOME' };
  },
  actions: {
    setUserData: assign({
      userId: ({ event }) => (event as any).userId,
      username: ({ event }) => (event as any).username,
      token: ({ event }) => (event as any).token,
    }),
    clearUserData: assign({
      userId: () => null,
      username: () => null,
      token: () => null,
    }),
    setGameCode: assign({
      gameCode: ({ event }) => (event as any).gameCode,
      isHost: () => true,
    }),
    setJoinedGame: assign({
      gameCode: ({ event }) => (event as any).gameCode,
      isHost: () => false,
    }),
    clearGameData: assign({
      gameCode: () => null,
      isHost: () => false,
      gameId: () => null,
      winner: () => null,
    }),
    setGameStarted: assign({
      gameId: ({ event }) => (event as any).gameId,
    }),
    setWinner: assign({
      winner: ({ event }) => (event as any).winner,
    }),
  },
}).createMachine({
  id: 'boardBotsUserJourney',
  initial: 'Idle',
  context: {
    userId: null,
    username: null,
    token: null,
    gameCode: null,
    isHost: false,
    gameId: null,
    currentTurn: 0,
    winner: null,
  },
  states: {
    // ==========================================
    // AUTHENTICATION FLOW
    // ==========================================
    Idle: {
      description: 'Landing page - user can login, register, create game, or join game',
      on: {
        CLICK_LOGIN: { target: 'LoginModal' },
        CLICK_REGISTER: { target: 'RegisterModal' },
        CREATE_GAME: { target: 'WaitingForOpponent', actions: ['setGameCode'] },
        CLICK_JOIN_GAME: { target: 'JoiningGame' },
      },
    },

    LoginModal: {
      description: 'Login modal is open',
      on: {
        CLOSE_MODAL: { target: 'Idle' },
        SWITCH_TO_REGISTER: { target: 'RegisterModal' },
        SUBMIT_LOGIN_SUCCESS: { target: 'Dashboard', actions: ['setUserData'] },
        SUBMIT_LOGIN_FAILED: { target: 'LoginModal' },
      },
    },

    RegisterModal: {
      description: 'Registration modal is open',
      on: {
        CLOSE_MODAL: { target: 'Idle' },
        SWITCH_TO_LOGIN: { target: 'LoginModal' },
        SUBMIT_REGISTER_SUCCESS: { target: 'Dashboard', actions: ['setUserData'] },
        SUBMIT_REGISTER_FAILED: { target: 'RegisterModal' },
      },
    },

    Dashboard: {
      description: 'Authenticated user dashboard',
      on: {
        LOGOUT: { target: 'Idle', actions: ['clearUserData'] },
        CREATE_GAME: { target: 'WaitingForOpponent', actions: ['setGameCode'] },
        CLICK_JOIN_GAME: { target: 'JoiningGame' },
      },
    },

    // ==========================================
    // LOBBY FLOW
    // ==========================================
    WaitingForOpponent: {
      description: 'Host created game, waiting for opponent to join',
      on: {
        LEAVE_LOBBY: { target: 'Idle', actions: ['clearGameData'] },
        START_GAME: { target: 'InGame', actions: ['setGameStarted'] },
      },
    },

    JoiningGame: {
      description: 'Guest is entering game code to join',
      on: {
        CLOSE_MODAL: { target: 'Idle' },
        JOIN_GAME: { target: 'WaitingForOpponent', actions: ['setJoinedGame'] },
      },
    },

    // ==========================================
    // GAMEPLAY FLOW
    // ==========================================
    InGame: {
      description: 'User is actively playing a game',
      on: {
        MAKE_MOVE: { target: 'InGame' },
        GAME_ENDED: { target: 'GameOver', actions: ['setWinner'] },
      },
    },

    GameOver: {
      description: 'Game has concluded, viewing results',
      on: {
        RETURN_TO_HOME: { target: 'Idle', actions: ['clearGameData'] },
      },
    },
  },
});
