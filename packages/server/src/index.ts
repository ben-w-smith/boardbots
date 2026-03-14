import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import * as path from "path";
import { fileURLToPath } from "url";
import { RoomManager } from "./RoomManager.js";
import { authRoutes, verifyToken, validateJwtSecret, requireAuth } from "./auth/index.js";
import { dbService } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Security headers
// Note: HSTS and upgrade-insecure-requests disabled until HTTPS is configured
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      // Explicitly remove upgrade-insecure-requests
      upgradeInsecureRequests: null,
    },
  },
  // Disable HSTS until HTTPS is configured
  hsts: false,
}));

// CORS configuration
const allowedOrigins = [
  "http://138.197.0.105",
  "http://boardbots.benwsmith.com",
  "https://boardbots.benwsmith.com",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow any localhost port for development
    const isLocalhost = origin && /^http:\/\/localhost:\d+$/.test(origin);
    if (!origin || allowedOrigins.includes(origin) || isLocalhost) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

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

// Auth routes
app.use("/api/auth", authRoutes);

// Create a new game lobby (requires authentication)
app.post("/api/lobby/create", requireAuth, (req, res) => {
  // Associate game with authenticated user
  const userId = req.user?.userId;
  const gameCode = generateGameCode();
  res.json({ gameCode, userId });
});

// Get game history for authenticated user
app.get("/api/games", requireAuth, (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Parse and validate query parameters
  let limit = parseInt(req.query.limit as string) || 20;
  let offset = parseInt(req.query.offset as string) || 0;

  // Enforce limits
  limit = Math.min(Math.max(1, limit), 50); // 1-50 range
  offset = Math.max(0, offset); // non-negative

  const games = dbService.getUserGames(userId, limit, offset);
  const total = dbService.getUserGamesCount(userId);

  res.json({
    games,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  });
});

// Get single game details for authenticated user
app.get("/api/games/:gameCode", requireAuth, (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const gameCode = String(req.params.gameCode).toUpperCase();

  const game = dbService.getUserGameDetail(userId, gameCode);
  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  res.json({
    game: {
      gameCode: game.gameCode,
      state: game.state,
      players: game.players,
      phase: game.phase,
      createdAt: game.createdAt,
      winnerId: game.winnerId,
      aiEnabled: game.aiEnabled === true || (game as any).aiEnabled === 1,
      aiDepth: game.aiDepth ?? 3,
      aiPlayerIndex: game.aiPlayerIndex ?? null,
    },
  });
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

    // Extract token from query parameter (preferred method)
    const token = url.searchParams.get("token") as string | null;
    const user = token ? verifyToken(token) : null;

    // Handle upgrade, accepting the auth-token protocol if provided
    wss.handleUpgrade(request, socket, head, (ws) => {
      RoomManager.getInstance().handleConnection(gameCode, ws, user);
    });
  } else {
    socket.destroy();
  }
});

// Validate environment configuration before starting server
validateJwtSecret();

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
