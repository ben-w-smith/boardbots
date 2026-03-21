import { Request, Response, NextFunction } from "express";
import { extractToken, verifyToken, JwtPayload } from "./jwt.js";

/** Extend Express Request to include user */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Allowed origins for CSRF protection
const defaultOrigins = [
  "https://boardbots.benwsmith.com",
  "http://boardbots.benwsmith.com",
  "http://138.197.0.105",
];

const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : defaultOrigins;

/**
 * CSRF protection middleware
 * Validates Origin header on state-changing requests
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only check on state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const host = req.headers.host;

  // Allow requests with no origin (mobile apps, curl, etc.)
  // but validate if origin is present
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
      // Allow any localhost port for development
      /^http:\/\/localhost:\d+$/.test(origin);

    if (!isAllowed) {
      res.status(403).json({ error: "Invalid origin" });
      return;
    }
  }

  next();
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req.headers.authorization);
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    req.user = payload;
  }
  next();
}
