import type { GameState, GameMove, Pair } from '@lockitdown/engine';
import { possibleMoves, pairKey, CARDINALS } from '@lockitdown/engine';

// WebMCP global type declaration
declare global {
  interface Window {
    webmcp?: {
      registerTool: (name: string, description: string, handler: () => unknown) => void;
      registerToolWithInput: (
        name: string,
        description: string,
        inputSchema: object,
        handler: (input: unknown) => unknown
      ) => void;
      registerResource: (uri: string, name: string, description: string, handler: () => unknown) => void;
      registerPrompt: (
        name: string,
        description: string,
        handler: (args?: Record<string, string>) => string
      ) => void;
    };
  }
}

// Game rules text for resource
const GAME_RULES = `Lock It Down is a 2-player strategy game on a hexagonal grid.

OBJECTIVE: Eliminate your opponent's robots. A player is eliminated when
they have 2 or fewer total robots (on board + unplaced).

ROBOTS: Each player has 6 robots. Robots have a position and a facing
direction. When a robot's beam is enabled, it fires in its facing direction.

TURNS: Each turn has 3 actions. You can:
- PLACE a robot (costs all 3 actions, must be first action)
- ADVANCE a robot one hex forward (costs 1 action)
- TURN a robot 60° left or right (costs 1 action)

BEAMS: Robots emit beams in their facing direction.
- 2 beams on one robot: LOCKED (cannot move)
- 3 beams on one robot: DESTROYED (removed, attackers get 1 point each)

CORRIDOR: The outer ring of hexes. Robots are placed here. Beams are
disabled in the corridor. Max 2 of your robots in corridor at once.

PLACEMENT: On your first action of a turn, you may place a new robot on an
empty corridor hex, facing inward toward the arena.

ADVANCE: Move one of your robots one hex forward in its facing direction.
Cannot advance if blocked by another robot or if the robot is locked.

TURN: Rotate a robot 60° left or right. Always available, even when locked.

WIN CONDITION: A player wins when their opponent has 2 or fewer robots
remaining (on the board plus unplaced in the corridor).`;

// Move history storage
let moveHistory: string[] = [];

// Callbacks to access game state
export interface WebMCPContext {
  getGameState: () => GameState | null;
  getPlayerIndex: () => number;
  getPlayers: () => string[];
  getPhase: () => string;
  sendMove: (move: GameMove) => void;
  requestAI: () => void;
}

let context: WebMCPContext | null = null;

// Add a move to history
export function logMoveForMCP(description: string): void {
  moveHistory.push(description);
}

// Clear move history (for new games)
export function clearMoveHistory(): void {
  moveHistory = [];
}

// Generate ASCII board representation
function generateBoardAscii(state: GameState): string {
  const radius = state.gameDef.board.hexaBoard.arenaRadius;
  const corridorRadius = radius + 1;
  const lines: string[] = [];

  // Create a map of robot positions
  const robotMap = new Map<string, { player: number; dir: string; locked: boolean }>();
  for (const robot of state.robots) {
    const dirIndex = CARDINALS.findIndex(c => c.q === robot.direction.q && c.r === robot.direction.r);
    const dirSymbols = ['→', '↘', '↙', '←', '↖', '↗'];
    robotMap.set(pairKey(robot.position), {
      player: robot.player,
      dir: dirSymbols[dirIndex] ?? '?',
      locked: robot.isLockedDown,
    });
  }

  lines.push(`Turn: Player ${state.playerTurn + 1} | Actions left: ${state.movesThisTurn}`);
  lines.push('');
  lines.push('  Player 1 (Blue): B  Player 2 (Red): R');
  lines.push('  Locked robots shown with *');
  lines.push('');

  // Generate hex grid (simplified rectangular representation)
  for (let r = -corridorRadius; r <= corridorRadius; r++) {
    let line = '';
    const indent = Math.abs(r) > radius ? '  ' : '';
    line += indent;

    for (let q = -corridorRadius; q <= corridorRadius; q++) {
      const pos = { q, r };
      const dist = Math.abs(q) + Math.abs(r) + Math.abs(-q - r);

      if (dist > corridorRadius * 2) {
        line += '  ';
        continue;
      }

      const key = pairKey(pos);
      const robot = robotMap.get(key);

      if (robot) {
        const playerChar = robot.player === 0 ? 'B' : 'R';
        const lockChar = robot.locked ? '*' : '';
        line += `${playerChar}${robot.dir}${lockChar}`;
      } else if (dist <= radius * 2) {
        line += ' ·';
      } else {
        line += ' o';
      }
    }
    lines.push(line);
  }

  lines.push('');
  lines.push('Legend: · = arena, o = corridor, →↘↙←↖↗ = facing direction');

  return lines.join('\n');
}

// Initialize WebMCP integration
export function initWebMCP(ctx: WebMCPContext): void {
  context = ctx;

  // Wait for webmcp to be available
  const checkAndInit = () => {
    if (!window.webmcp) {
      console.log('WebMCP not available yet, retrying...');
      setTimeout(checkAndInit, 500);
      return;
    }

    console.log('Initializing WebMCP integration...');
    registerTools();
    registerResources();
    registerPrompts();
    console.log('WebMCP integration complete');
  };

  checkAndInit();
}

function registerTools(): void {
  const webmcp = window.webmcp!;

  // Tool: get_game_state
  webmcp.registerTool(
    'get_game_state',
    'Get the current game state including all robots, positions, and turn info',
    () => {
      if (!context) return { error: 'WebMCP not initialized' };
      const state = context.getGameState();
      if (!state) return { error: 'No game state available' };

      return {
        playerTurn: state.playerTurn,
        movesThisTurn: state.movesThisTurn,
        winner: state.winner,
        robots: state.robots.map(r => ({
          player: r.player,
          position: r.position,
          direction: r.direction,
          isLockedDown: r.isLockedDown,
          isBeamEnabled: r.isBeamEnabled,
        })),
        phase: context.getPhase(),
        players: context.getPlayers(),
        myPlayerIndex: context.getPlayerIndex(),
      };
    }
  );

  // Tool: get_possible_moves
  webmcp.registerTool(
    'get_possible_moves',
    'Get all valid moves for the current player',
    () => {
      if (!context) return { error: 'WebMCP not initialized' };
      const state = context.getGameState();
      if (!state) return { error: 'No game state available' };

      const moves = possibleMoves(state);
      return {
        playerTurn: state.playerTurn,
        movesThisTurn: state.movesThisTurn,
        moves: moves.map(m => ({
          type: m.type,
          player: m.player,
          position: m.position,
          ...(m.type === 'turn' && { direction: m.direction }),
          ...(m.type === 'place' && { direction: m.direction }),
        })),
      };
    }
  );

  // Tool: make_move
  webmcp.registerToolWithInput(
    'make_move',
    'Execute a move in the game',
    {
      type: 'object',
      properties: {
        moveType: {
          type: 'string',
          enum: ['place', 'advance', 'turn'],
          description: 'The type of move to make',
        },
        position: {
          type: 'object',
          properties: {
            q: { type: 'number' },
            r: { type: 'number' },
          },
          description: 'The hex position for the move',
        },
        direction: {
          type: 'string',
          enum: ['left', 'right'],
          description: 'Direction for turn moves (left or right)',
        },
        facingDirection: {
          type: 'object',
          properties: {
            q: { type: 'number' },
            r: { type: 'number' },
          },
          description: 'Facing direction for place moves',
        },
      },
      required: ['moveType', 'position'],
    },
    (input: unknown) => {
      if (!context) return { error: 'WebMCP not initialized' };
      const state = context.getGameState();
      if (!state) return { error: 'No game state available' };

      const inp = input as {
        moveType: 'place' | 'advance' | 'turn';
        position: Pair;
        direction?: 'left' | 'right';
        facingDirection?: Pair;
      };

      // Validate it's our turn
      if (state.playerTurn !== context.getPlayerIndex()) {
        return { error: 'Not your turn' };
      }

      // Find the move in possible moves
      const moves = possibleMoves(state);

      let move: GameMove | undefined;

      if (inp.moveType === 'advance') {
        move = moves.find(
          m => m.type === 'advance' && m.position.q === inp.position.q && m.position.r === inp.position.r
        );
      } else if (inp.moveType === 'turn' && inp.direction) {
        move = moves.find(
          m =>
            m.type === 'turn' &&
            m.position.q === inp.position.q &&
            m.position.r === inp.position.r &&
            m.direction === inp.direction
        );
      } else if (inp.moveType === 'place' && inp.facingDirection) {
        move = moves.find(
          m =>
            m.type === 'place' &&
            m.position.q === inp.position.q &&
            m.position.r === inp.position.r &&
            m.direction.q === inp.facingDirection!.q &&
            m.direction.r === inp.facingDirection!.r
        );
      }

      if (!move) {
        return { error: 'Invalid move. Check get_possible_moves for valid options.' };
      }

      // Execute the move
      context.sendMove(move);

      return {
        success: true,
        move: {
          type: move.type,
          player: move.player,
          position: move.position,
          ...(move.type === 'turn' && { direction: move.direction }),
          ...(move.type === 'place' && { direction: move.direction }),
        },
      };
    }
  );

  // Tool: get_game_info
  webmcp.registerTool(
    'get_game_info',
    'Get game metadata including players, scores, and current turn',
    () => {
      if (!context) return { error: 'WebMCP not initialized' };
      const state = context.getGameState();
      if (!state) return { error: 'No game state available' };

      const players = context.getPlayers();
      const robotCounts = [0, 0];
      for (const robot of state.robots) {
        robotCounts[robot.player]++;
      }

      return {
        players: players.map((name, i) => ({
          name,
          index: i,
          robotCount: robotCounts[i],
        })),
        currentPlayer: state.playerTurn,
        currentTurnName: players[state.playerTurn] || `Player ${state.playerTurn + 1}`,
        actionsRemaining: state.movesThisTurn,
        phase: context.getPhase(),
        winner: state.winner >= 0 ? players[state.winner] : null,
        myPlayerIndex: context.getPlayerIndex(),
        myPlayerName: players[context.getPlayerIndex()] || `Player ${context.getPlayerIndex() + 1}`,
      };
    }
  );

  // Tool: request_ai_move
  webmcp.registerTool(
    'request_ai_move',
    'Request the server AI to make a move for the current player',
    () => {
      if (!context) return { error: 'WebMCP not initialized' };
      const state = context.getGameState();
      if (!state) return { error: 'No game state available' };

      if (state.playerTurn !== context.getPlayerIndex()) {
        return { error: 'Not your turn' };
      }

      context.requestAI();

      return {
        success: true,
        message: 'AI move requested. Check get_game_state for the updated board.',
      };
    }
  );
}

function registerResources(): void {
  const webmcp = window.webmcp!;

  // Resource: game rules
  webmcp.registerResource(
    'game://rules',
    'Game Rules',
    'Complete rules for Lock It Down board game',
    () => GAME_RULES
  );

  // Resource: board state
  webmcp.registerResource(
    'game://board',
    'Board State',
    'ASCII representation of the current game board',
    () => {
      if (!context) return 'WebMCP not initialized';
      const state = context.getGameState();
      if (!state) return 'No game state available';
      return generateBoardAscii(state);
    }
  );

  // Resource: move history
  webmcp.registerResource(
    'game://history',
    'Move History',
    'List of all moves made in the current game',
    () => {
      if (moveHistory.length === 0) {
        return 'No moves recorded yet.';
      }
      return moveHistory.map((m, i) => `${i + 1}. ${m}`).join('\n');
    }
  );
}

function registerPrompts(): void {
  const webmcp = window.webmcp!;

  // Prompt: analyze position
  webmcp.registerPrompt(
    'analyze_position',
    'Analyze the current board position and suggest strategic considerations',
    () => {
      if (!context) return 'WebMCP not initialized';
      const state = context.getGameState();
      if (!state) return 'No game state available';

      const myIndex = context.getPlayerIndex();
      const myRobots = state.robots.filter(r => r.player === myIndex);
      const oppRobots = state.robots.filter(r => r.player !== myIndex);
      const myLocked = myRobots.filter(r => r.isLockedDown).length;
      const oppLocked = oppRobots.filter(r => r.isLockedDown).length;

      return `Analyze this Lock It Down position:

My robots: ${myRobots.length} (${myLocked} locked)
Opponent robots: ${oppRobots.length} (${oppLocked} locked)
Actions remaining: ${state.movesThisTurn}

Board state:
${generateBoardAscii(state)}

Consider:
1. Robot positioning and beam coverage
2. Lock and destruction threats
3. Corridor control
4. Optimal move sequence for this turn

Use get_possible_moves to see available moves.`;
    }
  );

  // Prompt: suggest move
  webmcp.registerPrompt(
    'suggest_move',
    'Suggest the best move with explanation',
    (args?: Record<string, string>) => {
      if (!context) return 'WebMCP not initialized';
      const state = context.getGameState();
      if (!state) return 'No game state available';

      const style = args?.style || 'balanced';
      const myIndex = context.getPlayerIndex();

      return `Suggest the best move for Player ${myIndex + 1} in this Lock It Down position.

Play style: ${style} (${style === 'aggressive' ? 'prioritize destruction' : style === 'defensive' ? 'prioritize safety' : 'balance offense and defense'})

Current state:
${generateBoardAscii(state)}

First, use get_possible_moves to see all valid moves.
Then recommend the best move(s) and explain your reasoning.
If there are multiple actions this turn, suggest the full sequence.`;
    }
  );
}
