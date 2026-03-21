import rateLimit from "express-rate-limit";

/**
 * Rate limiter for login endpoint
 * Limits: 100 attempts per 15 minutes per IP address (increased for development)
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window (development mode)
  message: {
    error: "Too many login attempts, please try again later",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests against the limit
  skip: () => process.env.NODE_ENV === "test", // Skip in test environment
});

/**
 * Rate limiter for registration endpoint
 * Limits: 50 registrations per hour per IP address (increased for development)
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 requests per window (development mode)
  message: {
    error: "Too many registration attempts, please try again later",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test", // Skip in test environment
});
