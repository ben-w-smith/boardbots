import type { GameState, GameMove, Pair, Robot } from "@lockitdown/engine";
import { pairEq, pairAdd, CARDINALS, pairDist } from "@lockitdown/engine";

export type InputMode = "select" | "selectDirection";

export interface InputState {
  mode: InputMode;
  selectedRobot: Robot | null;
  placementPosition: Pair | null;
  validMoves: GameMove[];
}

export interface InputOptions {
  /** Called when a move should be executed */
  onMove: (move: GameMove) => void;
  /** Called when the input state changes */
  onStateChange: (state: InputState) => void;
}

export class InputHandler {
  private gameState: GameState | null = null;
  private playerIndex: number = 0;
  private state: InputState = {
    mode: "select",
    selectedRobot: null,
    placementPosition: null,
    validMoves: [],
  };
  private readonly onMoveCallback: (move: GameMove) => void;
  private readonly onStateChangeCallback: (state: InputState) => void;

  constructor(options: InputOptions) {
    this.onMoveCallback = options.onMove;
    this.onStateChangeCallback = options.onStateChange;
  }

  /** Update the current game state */
  setGameState(state: GameState): void {
    this.gameState = state;
    // Reset selection if game state changed significantly
    if (this.state.selectedRobot) {
      const robotStillExists = state.robots.some(
        (r) =>
          pairEq(r.position, this.state.selectedRobot!.position) &&
          r.player === this.state.selectedRobot!.player,
      );
      if (!robotStillExists) {
        this.resetSelection();
        return;
      }
    }
    this.updateValidMoves();
  }

  /** Set the current player index */
  setPlayerIndex(index: number): void {
    this.playerIndex = index;
    this.updateValidMoves();
  }

  /** Get current input state */
  getState(): InputState {
    return this.state;
  }

  /** Handle a hex click */
  handleClick(hex: Pair): void {
    if (!this.gameState) return;

    const isMyTurn = this.gameState.playerTurn === this.playerIndex;
    if (!isMyTurn) return;

    switch (this.state.mode) {
      case "select":
        this.handleSelectClick(hex);
        break;
      case "selectDirection":
        this.handleDirectionClick(hex);
        break;
    }
  }

  private handleSelectClick(hex: Pair): void {
    if (!this.gameState) return;

    // Check if it's the first action of the turn (can place)
    const canPlace =
      this.gameState.movesThisTurn === this.gameState.gameDef.movesPerTurn;

    // Check if clicking on own robot
    const clickedRobot = this.gameState.robots.find(
      (r) => pairEq(r.position, hex) && r.player === this.playerIndex,
    );

    if (clickedRobot) {
      // Select the robot
      this.state = {
        ...this.state,
        selectedRobot: clickedRobot,
        mode: "select",
      };
      this.updateValidMoves();
      this.onStateChangeCallback(this.state);
      return;
    }

    // Check if clicking on valid advance destination
    if (this.state.selectedRobot && !this.state.selectedRobot.isLockedDown) {
      const dest = pairAdd(
        this.state.selectedRobot.position,
        this.state.selectedRobot.direction,
      );
      if (pairEq(dest, hex)) {
        // Execute advance move
        const move: GameMove = {
          type: "advance",
          player: this.playerIndex,
          position: this.state.selectedRobot.position,
        };
        this.onMoveCallback(move);
        this.resetSelection();
        return;
      }
    }

    // Check if clicking on corridor for placement
    if (canPlace) {
      const corridorRadius =
        this.gameState.gameDef.board.hexaBoard.arenaRadius + 1;
      if (pairDist(hex) === corridorRadius) {
        // Check if position is empty
        const hasRobot = this.gameState.robots.some((r) =>
          pairEq(r.position, hex),
        );
        if (!hasRobot) {
          // Enter placement mode
          this.state = {
            ...this.state,
            mode: "selectDirection",
            placementPosition: hex,
            selectedRobot: null,
          };
          this.updateValidMoves();
          this.onStateChangeCallback(this.state);
          return;
        }
      }
    }

    // Clicking elsewhere deselects
    this.resetSelection();
  }

  private handleDirectionClick(hex: Pair): void {
    if (!this.gameState || !this.state.placementPosition) return;

    // Determine which direction based on hex clicked relative to placement position
    const clickedDirection = this.getClickDirection(
      this.state.placementPosition,
      hex,
    );
    if (clickedDirection) {
      // Execute place move
      const move: GameMove = {
        type: "place",
        player: this.playerIndex,
        position: this.state.placementPosition,
        direction: clickedDirection,
      };
      this.onMoveCallback(move);
      this.resetSelection();
    } else {
      // Cancel placement
      this.resetSelection();
    }
  }

  /** Handle turn button click */
  handleTurnClick(direction: "left" | "right"): void {
    if (!this.gameState || !this.state.selectedRobot) return;

    const move: GameMove = {
      type: "turn",
      player: this.playerIndex,
      position: this.state.selectedRobot.position,
      direction,
    };
    this.onMoveCallback(move);
    this.resetSelection();
  }

  /** Handle advance button click */
  handleAdvanceClick(): void {
    if (!this.gameState || !this.state.selectedRobot) return;

    const move: GameMove = {
      type: "advance",
      player: this.playerIndex,
      position: this.state.selectedRobot.position,
    };
    this.onMoveCallback(move);
    this.resetSelection();
  }

  /** Handle direction selection for placement */
  handleDirectionSelect(direction: Pair): void {
    if (!this.gameState || !this.state.placementPosition) return;

    const move: GameMove = {
      type: "place",
      player: this.playerIndex,
      position: this.state.placementPosition,
      direction,
    };
    this.onMoveCallback(move);
    this.resetSelection();
  }

  /** Cancel current selection */
  cancelSelection(): void {
    this.resetSelection();
  }

  private resetSelection(): void {
    this.state = {
      mode: "select",
      selectedRobot: null,
      placementPosition: null,
      validMoves: [],
    };
    this.updateValidMoves();
    this.onStateChangeCallback(this.state);
  }

  private updateValidMoves(): void {
    if (!this.gameState) {
      this.state.validMoves = [];
      return;
    }

    const moves: GameMove[] = [];
    const player = this.playerIndex;

    // If it's not our turn, no valid moves
    if (this.gameState.playerTurn !== player) {
      this.state.validMoves = [];
      return;
    }

    // Check if we can place (first action of turn)
    const canPlace =
      this.gameState.movesThisTurn === this.gameState.gameDef.movesPerTurn;
    if (canPlace) {
      const corridorRadius =
        this.gameState.gameDef.board.hexaBoard.arenaRadius + 1;

      // Count robots in corridor for this player
      const robotsInCorridor = this.gameState.robots.filter(
        (r) => r.player === player && pairDist(r.position) === corridorRadius,
      ).length;

      if (robotsInCorridor <= 1) {
        // Add placement moves
        for (let q = -corridorRadius; q <= corridorRadius; q++) {
          for (let r = -corridorRadius; r <= corridorRadius; r++) {
            if (pairDist({ q, r }) === corridorRadius) {
              const hasRobot = this.gameState!.robots.some((robot) =>
                pairEq(robot.position, { q, r }),
              );
              if (!hasRobot) {
                // Add all inward-facing directions
                for (const dir of CARDINALS) {
                  const facingPos = pairAdd({ q, r }, dir);
                  if (pairDist(facingPos) <= corridorRadius - 1) {
                    moves.push({
                      type: "place",
                      player,
                      position: { q, r },
                      direction: dir,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Add moves for selected robot (or all robots if none selected)
    const robotsToCheck = this.state.selectedRobot
      ? [this.state.selectedRobot]
      : this.gameState.robots.filter((r) => r.player === player);

    for (const robot of robotsToCheck) {
      // Advance move
      if (!robot.isLockedDown) {
        const dest = pairAdd(robot.position, robot.direction);
        const blocked = this.gameState!.robots.some((r) =>
          pairEq(r.position, dest),
        );
        if (!blocked) {
          moves.push({
            type: "advance",
            player,
            position: robot.position,
          });
        }
      }

      // Turn moves
      moves.push({
        type: "turn",
        player,
        position: robot.position,
        direction: "left",
      });
      moves.push({
        type: "turn",
        player,
        position: robot.position,
        direction: "right",
      });
    }

    this.state.validMoves = moves;
  }

  /** Determine direction based on click position */
  private getClickDirection(from: Pair, to: Pair): Pair | null {
    // Calculate relative position
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    // Filter out clicks on the exact same hex to avoid random default direction
    if (dq === 0 && dr === 0) {
      return null;
    }

    // Find closest cardinal direction
    let bestMatch: Pair | null = null;
    let bestDist = Infinity;

    for (const cardinal of CARDINALS) {
      const dist = Math.abs(cardinal.q - dq) + Math.abs(cardinal.r - dr);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = cardinal;
      }
    }

    // Only accept if reasonably close
    if (bestDist <= 2) {
      return bestMatch;
    }
    return null;
  }

  /** Get valid placement positions for highlighting */
  getValidPlacementPositions(): Pair[] {
    if (!this.gameState) return [];

    const positions: Pair[] = [];

    for (const move of this.state.validMoves) {
      if (move.type === "place") {
        positions.push(move.position);
      }
    }

    return positions;
  }

  /** Get valid advance destination positions for highlighting */
  getValidAdvancePositions(): Pair[] {
    if (!this.gameState || !this.state.selectedRobot) return [];

    const positions: Pair[] = [];
    for (const move of this.state.validMoves) {
      if (
        move.type === "advance" &&
        pairEq(move.position, this.state.selectedRobot!.position)
      ) {
        const dest = pairAdd(
          move.position,
          this.state.selectedRobot!.direction,
        );
        positions.push(dest);
      }
    }
    return positions;
  }

  /** Check if can turn left */
  canTurnLeft(): boolean {
    if (!this.state.selectedRobot) return false;
    return this.state.validMoves.some(
      (m) =>
        m.type === "turn" &&
        pairEq(m.position, this.state.selectedRobot!.position) &&
        m.direction === "left",
    );
  }

  /** Check if can turn right */
  canTurnRight(): boolean {
    if (!this.state.selectedRobot) return false;
    return this.state.validMoves.some(
      (m) =>
        m.type === "turn" &&
        pairEq(m.position, this.state.selectedRobot!.position) &&
        m.direction === "right",
    );
  }

  /** Check if can advance */
  canAdvance(): boolean {
    if (!this.state.selectedRobot) return false;
    return this.state.validMoves.some(
      (m) =>
        m.type === "advance" &&
        pairEq(m.position, this.state.selectedRobot!.position),
    );
  }

  /** Get valid directions for placement at current placement position */
  getValidPlacementDirections(): Pair[] {
    if (!this.state.placementPosition) return [];

    const directions: Pair[] = [];

    for (const move of this.state.validMoves) {
      if (
        move.type === "place" &&
        pairEq(move.position, this.state.placementPosition)
      ) {
        directions.push(move.direction);
      }
    }

    return directions;
  }
}
