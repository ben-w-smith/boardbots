import { Router, Request, Response } from "express";
import { dbService } from "../db.js";
import {
  hashPassword,
  comparePassword,
  validatePassword,
  validatePasswordStrength,
} from "./password.js";
import { generateToken } from "./jwt.js";
import { requireAuth } from "./middleware.js";
import { loginLimiter, registerLimiter } from "./rate-limiter.js";

const router = Router();

/**
 * Reserved usernames that cannot be registered
 */
const RESERVED_USERNAMES = new Set([
  "admin",
  "system",
  "api",
  "moderator",
  "bot",
]);

/**
 * Validate username format and restrictions
 * - 3-20 characters
 * - Alphanumeric plus underscore and hyphen only
 * - Not reserved
 */
function validateUsername(
  username: string
): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }
  if (username.length > 20) {
    return { valid: false, error: "Username must be at most 20 characters" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      valid: false,
      error:
        "Username can only contain letters, numbers, underscores, and hyphens",
    };
  }
  const lowercased = username.toLowerCase();
  if (RESERVED_USERNAMES.has(lowercased)) {
    return { valid: false, error: "This username is reserved" };
  }
  return { valid: true };
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  "/register",
  registerLimiter,
  async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      // Validate input types
      if (!username || typeof username !== "string") {
        return res.status(400).json({ error: "Username is required" });
      }
      if (!password || typeof password !== "string") {
        return res.status(400).json({ error: "Password is required" });
      }

      // Validate username format
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        return res.status(400).json({ error: usernameValidation.error });
      }

      // Validate password strength with specific error messages
      const passwordValidation = validatePasswordStrength(password);
      if (typeof passwordValidation !== "boolean" && !passwordValidation.valid) {
        return res.status(400).json({
          error: passwordValidation.errors.join(". "),
        });
      }

      // Normalize username to lowercase for case-insensitive handling
      const normalizedUsername = username.toLowerCase();

      // Check if username already exists (case-insensitive)
      const existingUser = dbService.getUserByUsername(normalizedUsername);
      if (existingUser) {
        return res.status(409).json({ error: "Username already taken" });
      }

      // Create user with normalized username
      const passwordHash = await hashPassword(password);
      const user = dbService.createUser(normalizedUsername, passwordHash);

      // Generate token
      const token = generateToken({
        userId: user.id,
        username: user.username,
      });

      res.status(201).json({
        user: { id: user.id, username: user.username },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/auth/login
 * Login an existing user
 */
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate input types
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password is required" });
    }

    // Normalize username to lowercase for case-insensitive lookup
    const normalizedUsername = username.toLowerCase();

    // Find user
    const user = dbService.getUserByUsername(normalizedUsername);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken({ userId: user.id, username: user.username });

    res.json({
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (protected)
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  // User is attached to request by requireAuth middleware
  res.json({ user: req.user });
});

/**
 * GET /api/user/stats
 * Get current user stats (protected)
 */
router.get("/stats", requireAuth, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const stats = dbService.getUserStats(req.user.userId);

  if (!stats) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ stats });
});

export default router;
