import rateLimit from "express-rate-limit";

/**
 * Rate limiter for login endpoint
 * Limits: 5 attempts per 15 minutes per IP address
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: "Too many login attempts, please try again later",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests against the limit
});

/**
 * Rate limiter for registration endpoint
 * Limits: 3 registrations per hour per IP address
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: {
    error: "Too many registration attempts, please try again later",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
