import type { WebSocket } from "ws";
import { GameRoom } from "./game-room.js";

export class RoomManager {
  private static instance: RoomManager;
  private rooms: Map<string, GameRoom> = new Map();

  private constructor() {}

  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  public async handleConnection(
    gameCode: string,
    ws: WebSocket,
  ): Promise<void> {
    let room = this.rooms.get(gameCode);

    if (!room) {
      room = new GameRoom(gameCode, (code) => this.cleanupRoom(code));
      this.rooms.set(gameCode, room);
    }

    await room.handleConnection(ws);
  }

  /**
   * Optional: Cleanup inactive rooms to save memory
   */
  public cleanupRoom(gameCode: string): void {
    this.rooms.delete(gameCode);
  }
}
