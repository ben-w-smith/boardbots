import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameUI } from "../gameui.js";
import {
  createGame,
  type GameMove,
  type TransportState,
} from "@lockitdown/engine";

// Helper to create a mock container
function createMockContainer(): HTMLElement {
  const container = document.createElement("div");
  container.id = "app";
  document.body.appendChild(container);
  return container;
}

describe("GameUI", () => {
  let ui: GameUI;
  let container: HTMLElement;
  let movesSent: GameMove[];
  let aiRequested: boolean;
  let startRequested: boolean;
  let rematchRequested: boolean;

  beforeEach(() => {
    container = createMockContainer();
    movesSent = [];
    aiRequested = false;
    startRequested = false;
    rematchRequested = false;

    ui = new GameUI({
      container,
      onMove: (move) => movesSent.push(move),
      onRequestAI: () => {
        aiRequested = true;
      },
      onStartGame: () => {
        startRequested = true;
      },
      onRematch: () => {
        rematchRequested = true;
      },
    });
  });

  describe("constructor", () => {
    it("creates a GameUI instance", () => {
      expect(ui).toBeInstanceOf(GameUI);
    });

    it("creates UI panels in the container", () => {
      expect(container.querySelector(".top-panel")).not.toBeNull();
      expect(container.querySelector(".bottom-panel")).not.toBeNull();
      expect(container.querySelector(".status-panel")).not.toBeNull();
      expect(container.querySelector(".right-panel")).not.toBeNull();
    });
  });

  describe("hide/show", () => {
    it("hides all panels", () => {
      ui.hide();

      const topPanel = container.querySelector(".top-panel") as HTMLElement;
      const bottomPanel = container.querySelector(
        ".bottom-panel",
      ) as HTMLElement;

      expect(topPanel.style.display).toBe("none");
      expect(bottomPanel.style.display).toBe("none");
    });

    it("shows all panels", () => {
      ui.hide();
      ui.show();

      const topPanel = container.querySelector(".top-panel") as HTMLElement;
      const bottomPanel = container.querySelector(
        ".bottom-panel",
      ) as HTMLElement;

      expect(topPanel.style.display).toBe("flex");
      expect(bottomPanel.style.display).toBe("flex");
    });
  });

  describe("setStatus", () => {
    it("shows connecting status", () => {
      ui.setStatus("connecting");

      const statusMessage = container.querySelector("#status-message");
      expect(statusMessage?.textContent).toBe("Connecting...");
    });

    it("shows connected status and hides after timeout", () => {
      vi.useFakeTimers();

      ui.setStatus("connected");

      const statusPanel = container.querySelector(
        ".status-panel",
      ) as HTMLElement;
      const statusMessage = container.querySelector("#status-message");

      // Message should be set correctly
      expect(statusMessage?.textContent).toBe("Connected");
      // Panel should be visible initially
      expect(statusPanel.style.display).toBe("block");

      // After 2s, panel should hide
      vi.advanceTimersByTime(2000);
      expect(statusPanel.style.display).toBe("none");

      vi.useRealTimers();
    });

    it("shows disconnected status with message", () => {
      ui.setStatus("disconnected", "Connection lost");

      const statusMessage = container.querySelector("#status-message");
      expect(statusMessage?.textContent).toBe("Connection lost");
    });
  });

  describe("showError", () => {
    it("displays error message", () => {
      ui.showError("Test error");

      const statusMessage = container.querySelector("#status-message");
      expect(statusMessage?.textContent).toBe("Test error");
      expect(statusMessage?.classList.contains("error")).toBe(true);
    });
  });

  describe("updateFromTransport", () => {
    it("updates game state from transport format", () => {
      const transportState: TransportState = {
        gameDef: {
          board: { hexaBoard: { arenaRadius: 4 } },
          numOfPlayers: 2,
          movesPerTurn: 3,
          robotsPerPlayer: 6,
          winCondition: "Elimination",
        },
        players: [
          { points: 0, placedRobots: 0 },
          { points: 0, placedRobots: 0 },
        ],
        robots: [],
        playerTurn: 2, // Player 2's turn (1-indexed, so playerIndex 1)
        status: "OnGoing",
        movesThisTurn: 3,
        requiresTieBreak: false,
      };

      ui.setPlayerIndex(0); // I am player 1
      ui.updateFromTransport(transportState, ["Player1", "Player2"], "playing");

      const turnInfo = container.querySelector(".current-turn");
      // playerTurn 2 means it's Player2's turn (1-indexed in transport)
      expect(turnInfo?.textContent).toContain("Player2's Turn");
    });
  });

  describe("setGameState", () => {
    it("updates game state directly", () => {
      const state = createGame({
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: "Elimination",
      });

      ui.setGameState(state);

      const movesLeft = container.querySelector(".moves-left");
      expect(movesLeft?.textContent).toContain("3");
    });
  });

  describe("setPlayerIndex", () => {
    it("sets the current player index", () => {
      const state = createGame({
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: "Elimination",
      });

      ui.setGameState(state);
      ui.setPlayerIndex(0);

      // Player 0's turn should show "Your Turn"
      const turnInfo = container.querySelector(".current-turn");
      expect(turnInfo?.textContent).toBe("Your Turn");
    });
  });

  describe("addMoveToHistory", () => {
    it("adds move to history log", () => {
      ui.addMoveToHistory("Player 1 advanced");

      const entries = container.querySelectorAll(".move-entry");
      expect(entries.length).toBe(1);
      expect(entries[0]?.textContent).toContain("Player 1 advanced");
    });

    it("keeps last 20 moves", () => {
      for (let i = 0; i < 25; i++) {
        ui.addMoveToHistory(`Move ${i + 1}`);
      }

      const entries = container.querySelectorAll(".move-entry");
      expect(entries.length).toBe(20);
    });
  });

  describe("showGameOver/hideGameOver", () => {
    it("shows game over message for winner", () => {
      ui.setPlayerIndex(0);
      ui.showGameOver(0, "Player1");

      // Check for the new victory overlay structure
      const overlay = container.querySelector("#victory-overlay");
      expect(overlay).not.toBeNull();

      const title = container.querySelector(".victory-title");
      expect(title?.textContent?.trim()).toBe("Victory!");
      expect(title?.classList.contains("winner")).toBe(true);
    });

    it("shows game over message for loser", () => {
      ui.setPlayerIndex(0);
      ui.showGameOver(1, "Player2");

      const title = container.querySelector(".victory-title");
      expect(title?.textContent?.trim()).toBe("Defeat");
      expect(title?.classList.contains("loser")).toBe(true);

      const subtitle = container.querySelector(".victory-subtitle");
      expect(subtitle?.textContent?.trim()).toBe("Player2 Wins!");
    });

    it("hides game over panel", async () => {
      ui.showGameOver(0, "Player1");
      ui.hideGameOver();

      // Wait for animation timeout
      await new Promise((resolve) => setTimeout(resolve, 350));

      const overlay = container.querySelector("#victory-overlay");
      expect(overlay).toBeNull();
    });
  });

  describe("button handlers", () => {
    it("handles AI button click", () => {
      const state = createGame({
        board: { hexaBoard: { arenaRadius: 4 } },
        numOfPlayers: 2,
        movesPerTurn: 3,
        robotsPerPlayer: 6,
        winCondition: "Elimination",
      });
      ui.setGameState(state);
      ui.updateFromTransport(
        {
          gameDef: state.gameDef,
          players: state.players,
          robots: [],
          playerTurn: 1,
          status: "OnGoing",
          movesThisTurn: 3,
          requiresTieBreak: false,
        },
        ["Player1", "Player2"],
        "playing",
      );

      const btnAI = container.querySelector("#btn-ai") as HTMLButtonElement;
      btnAI?.click();

      expect(aiRequested).toBe(true);
    });

    it("handles start button click", () => {
      const transportState: TransportState = {
        gameDef: {
          board: { hexaBoard: { arenaRadius: 4 } },
          numOfPlayers: 2,
          movesPerTurn: 3,
          robotsPerPlayer: 6,
          winCondition: "Elimination",
        },
        players: [
          { points: 0, placedRobots: 0 },
          { points: 0, placedRobots: 0 },
        ],
        robots: [],
        playerTurn: 1,
        status: "OnGoing",
        movesThisTurn: 3,
        requiresTieBreak: false,
      };

      ui.updateFromTransport(transportState, ["Player1", "Player2"], "waiting");

      const btnStart = container.querySelector(
        "#btn-start",
      ) as HTMLButtonElement;
      btnStart?.click();

      expect(startRequested).toBe(true);
    });
  });
});
