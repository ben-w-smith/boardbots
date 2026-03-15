import jwt from "jsonwebtoken";
import crypto from "crypto";

const DEFAULT_SECRET = "dev-secret-change-in-production";
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN = "15m"; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRES_IN = "7d"; // Long-lived refresh tokens

// Token revocation blacklist (in-memory, clears on server restart)
const revokedTokens = new Map<string, number>();
const REVOCATION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Periodic cleanup of expired revocations
setInterval(() => {
  const now = Date.now();
  for (const [tokenId, expiry] of revokedTokens) {
    if (expiry < now) {
      revokedTokens.delete(tokenId);
    }
  }
}, REVOCATION_CLEANUP_INTERVAL);

/**
 * Revoke a refresh token by its ID
 */
export function revokeToken(tokenId: string): void {
  // Store with expiry time (7 days in ms)
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  revokedTokens.set(tokenId, expiry);
}

/**
 * Check if a token ID has been revoked
 */
export function isTokenRevoked(tokenId: string): boolean {
  return revokedTokens.has(tokenId);
}

/**
 * Validate JWT_SECRET configuration.
 * Throws in production if JWT_SECRET is not set.
 * Logs warning in development if using default secret.
 */
export function validateJwtSecret(): void {
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET environment variable must be set in production"
    );
  }

  if (JWT_SECRET === DEFAULT_SECRET) {
    console.warn(
      "[auth] WARNING: Using default JWT secret. Set JWT_SECRET environment variable for security."
    );
  }
}

export interface JwtPayload {
  userId: number;
  username: string;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Format: "Bearer <token>"
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

/**
 * Refresh token payload (includes token family for rotation)
 */
export interface RefreshTokenPayload {
  userId: number;
  username: string;
  tokenId: string; // Unique ID for this token family
}

/**
 * Generate a refresh token for a user
 * Refresh tokens are longer-lived and used to get new access tokens
 */
export function generateRefreshToken(payload: JwtPayload): string {
  const tokenId = crypto.randomUUID();
  return jwt.sign(
    { ...payload, tokenId, type: "refresh" },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

/**
 * Verify a refresh token
 * Returns null if token is invalid, revoked, or not a refresh token
 */
export function verifyRefreshToken(token: string): (JwtPayload & { tokenId: string }) | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & { tokenId: string; type?: string };
    // Ensure this is a refresh token
    if (payload.type !== "refresh") {
      return null;
    }
    // Check if token has been revoked
    if (isTokenRevoked(payload.tokenId)) {
      return null;
    }
    return { userId: payload.userId, username: payload.username, tokenId: payload.tokenId };
  } catch {
    return null;
  }
}

/**
 * Generate both access and refresh tokens for a user
 */
export function generateTokenPair(payload: JwtPayload): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
