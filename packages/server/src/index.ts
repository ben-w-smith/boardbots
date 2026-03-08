import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import * as path from "path";
import { fileURLToPath } from "url";
import { RoomManager } from "./RoomManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

// Helper to generate a random 6-character alphanumeric game code
function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Health check
app.get("/api/health", (req, res) => {
  res.send("OK");
});

// Create a new game lobby
app.post("/api/lobby/create", (req, res) => {
  const gameCode = generateGameCode();
  res.json({ gameCode });
});

// SPA routing fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/game/")) {
    const gameCode = pathname.replace("/api/game/", "").toUpperCase().trim();

    if (!gameCode || gameCode.length !== 6) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      RoomManager.getInstance().handleConnection(gameCode, ws);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
