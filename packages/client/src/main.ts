import "./style.css";
import { BoardRenderer, type Highlight } from "./renderer.js";
import { GameUI } from "./gameui.js";
import { InputHandler, type InputState } from "./input.js";
import { GameSocket } from "./websocket.js";
import { LobbyUI, getSavedPlayerName, savePlayerName } from "./lobby.js";
import { animator } from "./animator.js";
import { getAudioManager } from "./audio.js";
import {
  initWebMCP,
  logMoveForMCP,
  clearMoveHistory,
  type WebMCPContext,
} from "./webmcp.js";
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
  type TransportState,
  type Robot,
  CARDINALS,
} from "@lockitdown/engine";

// Game configuration
const GAME_DEF = {
  board: { hexaBoard: { arenaRadius: 4 } },
  numOfPlayers: 2,
  movesPerTurn: 3,
  robotsPerPlayer: 6,
  winCondition: "Elimination",
};

// URL parameters
const urlParams = new URLSearchParams(window.location.search);
const urlGameCode = urlParams.get("game") || "";
const urlPlayerName = urlParams.get("name") || getSavedPlayerName() || "";
const isDemoMode = urlParams.has("demo");

// Generate random player name only if needed
function generatePlayerName(): string {
  return `Player_${Math.random().toString(36).substring(2, 6)}`;
}

// State
let state = createGame(GAME_DEF);
let previousState: GameState | null = null;
let highlights: Highlight[] = [];
let inputState: InputState;
let isConnected = false;
let myPlayerIndex = 0;
let currentGameCode: string = urlGameCode;
let currentPlayerName: string = urlPlayerName;
let currentPlayers: string[] = [];
let currentPhase: string = "waiting";

// Initialize audio manager
const audioManager = getAudioManager();

// Initialize canvas renderer
const canvas = document.querySelector<HTMLCanvasElement>("#gameCanvas")!;
const renderer = new BoardRenderer(canvas, { animator });

// Initialize WebSocket
const socket = new GameSocket({
  maxReconnectAttempts: 5,
  reconnectDelay: 2000,
});

// Initialize input handler
const inputHandler = new InputHandler({
  onMove: (move: GameMove) => {
    // Update move position from selected robot
    if (
      inputState.selectedRobot &&
      (move.type === "turn" || move.type === "advance")
    ) {
      move = { ...move, position: inputState.selectedRobot.position };
    }
    socket.sendMove(move);
    logMove(move);
  },
  onStateChange: (newState: InputState) => {
    inputState = newState;
    updateHighlights();
    gameUI.updateInputState(
      inputState,
      inputState.selectedRobot?.position ?? null,
    );
    gameUI.setSelectedRobotPosition(inputState.selectedRobot?.position ?? null);
    render();
  },
});

// Initialize input state
inputState = inputHandler.getState();
inputHandler.setGameState(state);
inputHandler.setPlayerIndex(myPlayerIndex);

// Initialize game UI
const appContainer = document.getElementById("app")!;
const gameUI = new GameUI({
  container: appContainer,
  onMove: (move: GameMove) => {
    // This is called from UI buttons (turn left/right/advance)
    if (inputState.selectedRobot) {
      move = { ...move, position: inputState.selectedRobot.position };
      socket.sendMove(move);
      logMove(move);
    }
  },
  onRequestAI: () => {
    socket.requestAI();
  },
  onStartGame: () => {
    socket.startGame();
  },
  onRematch: () => {
    socket.rematch();
    gameUI.hideGameOver();
    resetGame();
  },
});

// Initialize lobby UI
const lobbyUI = new LobbyUI({
  container: appContainer,
  onCreateGame: async (playerName: string): Promise<string | null> => {
    currentPlayerName = playerName;
    savePlayerName(playerName);

    try {
      const response = await fetch("/api/lobby/create", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        return data.gameCode;
      }
    } catch (error) {
      console.error("Failed to create game:", error);
    }
    return null;
  },
  onCreateAIGame: async (playerName: string, aiDepth: number): Promise<string | null> => {
    currentPlayerName = playerName;
    savePlayerName(playerName);

    try {
      // Create game normally first to get game code
      const response = await fetch("/api/lobby/create", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        const gameCode = data.gameCode;

        // Connect to the game
        socket.connect(gameCode, playerName);

        // Wait a bit for connection to establish, then start AI game
        setTimeout(() => {
          socket.startAIGame(aiDepth);
        }, 500);

        return gameCode;
      }
    } catch (error) {
      console.error("Failed to create AI game:", error);
    }
    return null;
  },
  onJoinGame: (gameCode: string, playerName: string) => {
    currentPlayerName = playerName;
    currentGameCode = gameCode;
    savePlayerName(playerName);
    // Update URL without reload
    window.history.pushState({}, "", `?game=${gameCode}`);
    // Connect to game
    connectToGame(gameCode, playerName);
  },
  onConnectToGame: (gameCode: string, playerName: string) => {
    // Called when host creates a game - connect but keep showing lobby
    currentGameCode = gameCode;
    // Update URL without reload
    window.history.pushState({}, "", `?game=${gameCode}`);
    // Connect via WebSocket but don't transition to game view yet
    socket.connect(gameCode, playerName);
  },
});

// Set up WebSocket callbacks
socket.onStateUpdate(
  (transportState: TransportState | null, players: string[], phase: string, aiEnabled?: boolean, aiPlayerIndex?: number) => {
    currentPlayers = players;
    currentPhase = phase;

    // Only update game state if transport state is available (null before game starts)
    if (transportState) {
      previousState = state;
      state = fromTransport(transportState);

      // Detect turn change - play sound if it became my turn
      if (previousState && previousState.playerTurn !== state.playerTurn) {
        // Play turn sound for the player whose turn it is
        const newTurnPlayerIndex = state.playerTurn;
        // Don't play turn sound for AI turns
        const isAITurn = aiEnabled && newTurnPlayerIndex === aiPlayerIndex;
        if (newTurnPlayerIndex === myPlayerIndex && !isAITurn) {
          audioManager.playTurnSound();
        }
      }

      // Detect changes and trigger animations
      detectAndAnimateChanges();

      inputHandler.setGameState(state);
      inputState = inputHandler.getState(); // Sync global inputState with updated selection
      gameUI.updateFromTransport(transportState, players, phase, aiEnabled, aiPlayerIndex);
    }

    // Find my player index
    const myIndex = players.indexOf(currentPlayerName);
    if (myIndex >= 0) {
      myPlayerIndex = myIndex;
      inputHandler.setPlayerIndex(myIndex);
      gameUI.setPlayerIndex(myIndex);
    }

    // Transition from lobby to game when phase changes to playing
    if (phase === "playing" || phase === "finished") {
      lobbyUI.hide();
      gameUI.show();
    }

    // When both players connected in waiting phase, show game view with Start button
    // For AI games, transition immediately when phase becomes playing
    if (phase === "waiting" && players.length >= 2) {
      lobbyUI.hide();
      gameUI.show();
    }

    render();

    // Start animation loop if animations are playing
    startAnimationLoop();
  },
);

// Detect state changes and trigger animations
function detectAndAnimateChanges(): void {
  if (!previousState) return;

  const prevRobots = previousState.robots;
  const currRobots = state.robots;

  // Create maps for quick lookup
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
      // New robot placed - trigger placement animation
      animator.animatePlacement(key, robot.position);
    }
  }

  // Check for removed robots (destruction)
  for (const [key, robot] of prevRobotMap) {
    if (!currRobotMap.has(key)) {
      // Robot destroyed - trigger destruction animation
      const color =
        robot.player === 0 ? "rgb(0, 212, 255)" : "rgb(255, 68, 68)";
      animator.animateDestruction(robot.position, color, (q, r) =>
        renderer.getPixelFromHex(q, r),
      );
      // Play laser hit and destruction sounds
      audioManager.playLaserHitSound();
      setTimeout(() => audioManager.playRobotDestroyedSound(), 50);
    }
  }

  // Check for robot movement and lock status changes
  for (const robot of currRobots) {
    const key = pairKey(robot.position);
    const prevRobot = prevRobotMap.get(key);

    // Check if robot moved from a previous position
    for (const [prevKey, prevR] of prevRobotMap) {
      if (prevR.player === robot.player && prevKey !== key) {
        // Check if this is the same robot that moved using hex distance + direction check
        const movedFromPrev =
          !currRobotMap.has(prevKey) &&
          pairDist(pairSub(robot.position, prevR.position)) === 1 &&
          pairEq(robot.position, pairAdd(prevR.position, prevR.direction));

        if (movedFromPrev) {
          // Robot advanced - trigger advance animation
          animator.animateAdvance(prevKey, prevR.position, robot.position);
          audioManager.playMoveSound();
          break;
        }
      }
    }

    // Check for turn (same position but different direction)
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
        // Robot turned - trigger turn animation
        animator.animateTurn(key, prevAngle, currAngle);
        audioManager.playMoveSound();
      }

      // Check for lock status change
      if (!prevRobot.isLockedDown && robot.isLockedDown) {
        // Robot just got locked - trigger flash
        animator.animateLockFlash(key);
        // Play lock sound
        audioManager.playRobotLockedSound();
      }
    }
  }
}

socket.onError((message: string) => {
  gameUI.showError(message);
});

socket.onStatusChange((status) => {
  gameUI.setStatus(status);
  isConnected = status === "connected";
});

socket.onGameOver((winner: number, winnerName: string) => {
  // Play victory sound if I won, defeat sound if I lost
  if (winner === myPlayerIndex) {
    audioManager.playVictorySound();
  }
  gameUI.showGameOver(winner, winnerName);
});

socket.onPlayerJoined((name: string, _index: number) => {
  // Player joined: ${name}
  // The gameState broadcast will handle UI updates,
  // but this ensures we show status feedback immediately
  gameUI.setStatus("connected", `${name} joined the game`);
});

// Event handlers
function handleResize() {
  renderer.resize();
  render();
}

function handleClick(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const clickedHex = renderer.pixelToHex(x, y);
  if (clickedHex) {
    inputHandler.handleClick(clickedHex);
  }
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  inputHandler.cancelSelection();
}

// Update highlights based on input state
function updateHighlights() {
  highlights = [];

  if (inputState.mode === "select" && inputState.selectedRobot) {
    highlights.push({
      position: inputState.selectedRobot.position,
      type: "selected",
    });

    // Show valid advance position
    if (!inputState.selectedRobot.isLockedDown) {
      const dest = {
        q:
          inputState.selectedRobot.position.q +
          inputState.selectedRobot.direction.q,
        r:
          inputState.selectedRobot.position.r +
          inputState.selectedRobot.direction.r,
      };
      const blocked = state.robots.some((r) => pairEq(r.position, dest));
      if (!blocked) {
        highlights.push({ position: dest, type: "validMove" });
      }
    }
  } else if (
    inputState.mode === "selectDirection" &&
    inputState.placementPosition
  ) {
    // Highlight placement position
    highlights.push({
      position: inputState.placementPosition,
      type: "selected",
    });

    // Show valid directions to click
    const validDirs = inputHandler.getValidPlacementDirections();
    for (const dir of validDirs) {
      highlights.push({
        position: pairAdd(inputState.placementPosition, dir),
        type: "validMove",
      });
    }
  }

  // Show valid placement positions when it's first action of turn
  if (
    state.playerTurn === myPlayerIndex &&
    state.movesThisTurn === state.gameDef.movesPerTurn &&
    !inputState.selectedRobot
  ) {
    const placementPositions = inputHandler.getValidPlacementPositions();
    for (const pos of placementPositions) {
      highlights.push({ position: pos, type: "validMove" });
    }
  }
}

// Log a move
function logMove(move: GameMove) {
  let description = "";
  const playerNameStr = `Player ${move.player + 1}`;

  switch (move.type) {
    case "place":
      description = `${playerNameStr} placed at (${move.position.q}, ${move.position.r})`;
      break;
    case "advance":
      description = `${playerNameStr} advanced from (${move.position.q}, ${move.position.r})`;
      break;
    case "turn":
      description = `${playerNameStr} turned ${move.direction} at (${move.position.q}, ${move.position.r})`;
      break;
  }

  gameUI.addMoveToHistory(description);
  logMoveForMCP(description);
}

// Reset game
function resetGame() {
  state = createGame(GAME_DEF);
  highlights = [];
  inputHandler.setGameState(state);
  clearMoveHistory();
  render();
}

// Render the game
function render() {
  updateHighlights();
  renderer.render(state, highlights);
}

// Animation loop for smooth animations
let animationFrameId: number | null = null;

function startAnimationLoop(): void {
  if (animationFrameId !== null) return;

  function loop() {
    render();
    if (animator.isAnimating()) {
      animationFrameId = requestAnimationFrame(loop);
    } else {
      animationFrameId = null;
    }
  }
  animationFrameId = requestAnimationFrame(loop);
}

// Connect to a game
function connectToGame(gameCode: string, playerName: string) {
  lobbyUI.hide();
  gameUI.setStatus("connecting");
  gameUI.show();
  socket.connect(gameCode, playerName);
  render();
}

// Connect or use demo mode
function init() {
  if (isDemoMode) {
    // Demo mode - just render with sample state
    setupDemoState();
    gameUI.hide();
    lobbyUI.hide();
  } else if (currentGameCode && currentPlayerName) {
    // Game code in URL - connect directly
    connectToGame(currentGameCode, currentPlayerName);
  } else if (currentGameCode && !currentPlayerName) {
    // Game code but no name - generate one and connect
    currentPlayerName = generatePlayerName();
    connectToGame(currentGameCode, currentPlayerName);
  } else {
    // No game code - show lobby
    setupDemoState();
    gameUI.hide();
    lobbyUI.show();
  }
  render();
}

// Setup demo state for testing without server
function setupDemoState() {
  state.robots = [
    // Player 1 robots (blue)
    {
      position: { q: 0, r: 5 },
      direction: CARDINALS[0],
      isBeamEnabled: true,
      isLockedDown: false,
      player: 0,
    },
    {
      position: { q: -2, r: 5 },
      direction: CARDINALS[3],
      isBeamEnabled: true,
      isLockedDown: false,
      player: 0,
    },
    {
      position: { q: 2, r: 2 },
      direction: CARDINALS[1],
      isBeamEnabled: false,
      isLockedDown: false,
      player: 0,
    },
    // Player 2 robots (red)
    {
      position: { q: 0, r: -5 },
      direction: CARDINALS[3],
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    },
    {
      position: { q: 2, r: -5 },
      direction: CARDINALS[4],
      isBeamEnabled: true,
      isLockedDown: false,
      player: 1,
    },
    {
      position: { q: -1, r: -2 },
      direction: CARDINALS[5],
      isBeamEnabled: false,
      isLockedDown: true,
      player: 1,
    },
  ];

  inputHandler.setGameState(state);
}

// Set up event listeners
window.addEventListener("resize", handleResize);
canvas.addEventListener("click", handleClick);
canvas.addEventListener("contextmenu", handleContextMenu);

// Sound toggle event listener
window.addEventListener("soundToggle", () => {
  const isMuted = audioManager.toggleMute();
  // Dispatch event to update UI
  window.dispatchEvent(new CustomEvent("soundStateChanged", { detail: { isMuted } }));
});

// Keyboard shortcuts
document.addEventListener("keydown", (event) => {
  if (!isConnected && currentGameCode) return;

  switch (event.key) {
    case "Escape":
      inputHandler.cancelSelection();
      break;
    case "q":
    case "Q":
      if (inputState.selectedRobot) {
        inputHandler.handleTurnClick("left");
      }
      break;
    case "e":
    case "E":
      if (inputState.selectedRobot) {
        inputHandler.handleTurnClick("right");
      }
      break;
    case "w":
    case "W":
    case " ":
      if (inputState.selectedRobot) {
        inputHandler.handleAdvanceClick();
      }
      break;
    case "m":
    case "M":
      // Toggle sound with M key
      const isMuted = audioManager.toggleMute();
      window.dispatchEvent(new CustomEvent("soundStateChanged", { detail: { isMuted } }));
      break;
  }
});

// Initialize
init();

// Initialize WebMCP
const webmcpContext: WebMCPContext = {
  getGameState: () => state,
  getPlayerIndex: () => myPlayerIndex,
  getPlayers: () => currentPlayers,
  getPhase: () => currentPhase,
  sendMove: (move: GameMove) => socket.sendMove(move),
  requestAI: () => socket.requestAI(),
};
initWebMCP(webmcpContext);

// Expose for debugging
Object.assign(window as unknown as Record<string, unknown>, {
  gameState: state,
  renderer,
  socket,
  inputHandler,
  lobbyUI,
});
