import jwt from "jsonwebtoken";

const DEFAULT_SECRET = "dev-secret-change-in-production";
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN = "7d";

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
