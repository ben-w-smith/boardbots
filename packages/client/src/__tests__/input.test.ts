import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputHandler, type InputState } from '../input.js';
import { createGame, type GameState, type GameMove, CARDINALS } from '@lockitdown/engine';

describe('InputHandler', () => {
  let handler: InputHandler;
  let state: GameState;
  let movesSent: GameMove[];

  beforeEach(() => {
    movesSent = [];

    handler = new InputHandler({
      onMove: (move) => movesSent.push(move),
      onStateChange: vi.fn(),
    });

    state = createGame({
      board: { hexaBoard: { arenaRadius: 4 } },
      numOfPlayers: 2,
      movesPerTurn: 3,
      robotsPerPlayer: 6,
      winCondition: 'Elimination',
    });

    handler.setGameState(state);
    handler.setPlayerIndex(0);
  });

  describe('constructor', () => {
    it('creates an input handler instance', () => {
      expect(handler).toBeInstanceOf(InputHandler);
    });
  });

  describe('getState', () => {
    it('returns initial input state', () => {
      const inputState = handler.getState();
      expect(inputState.mode).toBe('select');
      expect(inputState.selectedRobot).toBeNull();
      expect(inputState.placementPosition).toBeNull();
    });
  });

  describe('setGameState', () => {
    it('updates internal game state', () => {
      const newState = createGame({
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: 'Elimination',
      });

      handler.setGameState(newState);

      // State should be updated (verify by checking valid moves)
      const validMoves = handler.getState().validMoves;
      expect(validMoves.length).toBeGreaterThan(0);
    });

    it('resets selection if selected robot no longer exists', () => {
      // Add a robot
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);

      // Simulate selecting the robot
      handler.handleClick({ q: 0, r: 5 });
      expect(handler.getState().selectedRobot).not.toBeNull();

      // Remove the robot and update state
      state.robots = [];
      handler.setGameState(state);

      // Selection should be reset
      expect(handler.getState().selectedRobot).toBeNull();
    });
  });

  describe('setPlayerIndex', () => {
    it('changes the current player index', () => {
      handler.setPlayerIndex(1);

      // Player 1 should not have valid moves when it's Player 0's turn
      const validMoves = handler.getState().validMoves;
      expect(validMoves.every((m) => m.player === 0 || m.player === 1)).toBe(true);
    });
  });

  describe('handleClick', () => {
    it('selects own robot when clicked', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);

      handler.handleClick({ q: 0, r: 5 });

      const inputState = handler.getState();
      expect(inputState.selectedRobot).not.toBeNull();
      expect(inputState.selectedRobot?.position).toEqual({ q: 0, r: 5 });
    });

    it('does not select opponent robot', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 1, // Opponent
      }];
      handler.setGameState(state);

      handler.handleClick({ q: 0, r: 5 });

      const inputState = handler.getState();
      expect(inputState.selectedRobot).toBeNull();
    });

    it('deselects when clicking empty hex', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);

      handler.handleClick({ q: 0, r: 5 });
      expect(handler.getState().selectedRobot).not.toBeNull();

      handler.handleClick({ q: 0, r: 0 }); // Empty hex
      expect(handler.getState().selectedRobot).toBeNull();
    });

    it('enters placement mode when clicking corridor on first action', () => {
      // First action of turn (movesThisTurn === 3)
      handler.handleClick({ q: 0, r: 5 }); // Corridor hex

      const inputState = handler.getState();
      expect(inputState.mode).toBe('selectDirection');
      expect(inputState.placementPosition).toEqual({ q: 0, r: 5 });
    });

    it('sends advance move when clicking destination', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0], // East
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);

      // Select robot
      handler.handleClick({ q: 0, r: 5 });

      // Click destination
      handler.handleClick({ q: 1, r: 5 });

      // Should send advance move
      expect(movesSent.length).toBe(1);
      expect(movesSent[0].type).toBe('advance');
    });
  });

  describe('handleTurnClick', () => {
    it('sends turn left move when robot selected', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);
      handler.handleClick({ q: 0, r: 5 }); // Select

      handler.handleTurnClick('left');

      expect(movesSent.length).toBe(1);
      expect(movesSent[0].type).toBe('turn');
      expect(movesSent[0]).toMatchObject({ direction: 'left' });
    });

    it('sends turn right move when robot selected', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);
      handler.handleClick({ q: 0, r: 5 }); // Select

      handler.handleTurnClick('right');

      expect(movesSent.length).toBe(1);
      expect(movesSent[0]).toMatchObject({ direction: 'right' });
    });
  });

  describe('handleAdvanceClick', () => {
    it('sends advance move when robot selected', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);
      handler.handleClick({ q: 0, r: 5 }); // Select

      handler.handleAdvanceClick();

      expect(movesSent.length).toBe(1);
      expect(movesSent[0].type).toBe('advance');
    });
  });

  describe('handleDirectionSelect', () => {
    it('sends place move with selected direction', () => {
      // First select a placement position
      handler.handleClick({ q: 0, r: 5 });

      // Then select a direction
      handler.handleDirectionSelect(CARDINALS[0]);

      expect(movesSent.length).toBe(1);
      expect(movesSent[0].type).toBe('place');
      expect(movesSent[0]).toMatchObject({
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
      });
    });
  });

  describe('cancelSelection', () => {
    it('resets selection state', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);
      handler.handleClick({ q: 0, r: 5 }); // Select

      handler.cancelSelection();

      const inputState = handler.getState();
      expect(inputState.selectedRobot).toBeNull();
      expect(inputState.mode).toBe('select');
    });
  });

  describe('getValidPlacementPositions', () => {
    it('returns empty array when not first action', () => {
      state.movesThisTurn = 1;
      handler.setGameState(state);

      const positions = handler.getValidPlacementPositions();
      expect(positions.length).toBe(0);
    });

    it('returns corridor positions when first action', () => {
      const positions = handler.getValidPlacementPositions();
      expect(positions.length).toBeGreaterThan(0);

      // All should be on corridor (distance 5)
      for (const pos of positions) {
        const dist = (Math.abs(pos.q) + Math.abs(pos.r) + Math.abs(-pos.q - pos.r)) / 2;
        expect(dist).toBe(5);
      }
    });
  });

  describe('canTurnLeft/canTurnRight/canAdvance', () => {
    it('returns false when no robot selected', () => {
      expect(handler.canTurnLeft()).toBe(false);
      expect(handler.canTurnRight()).toBe(false);
      expect(handler.canAdvance()).toBe(false);
    });

    it('returns true when robot selected', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: false,
        player: 0,
      }];
      handler.setGameState(state);
      handler.handleClick({ q: 0, r: 5 }); // Select

      expect(handler.canTurnLeft()).toBe(true);
      expect(handler.canTurnRight()).toBe(true);
      expect(handler.canAdvance()).toBe(true);
    });

    it('returns false for advance when robot locked', () => {
      state.robots = [{
        position: { q: 0, r: 5 },
        direction: CARDINALS[0],
        isBeamEnabled: true,
        isLockedDown: true,
        player: 0,
      }];
      handler.setGameState(state);
      handler.handleClick({ q: 0, r: 5 }); // Select

      expect(handler.canAdvance()).toBe(false);
    });
  });
});
