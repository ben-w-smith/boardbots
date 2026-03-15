import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12; // Increased from 10 for stronger security

/**
 * Hash a plaintext password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password with a hashed password
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Password validation error type
 */
export interface PasswordValidationError {
  valid: false;
  errors: string[];
}

/**
 * Validate password strength with specific error messages
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePasswordStrength(
  password: string
): boolean | PasswordValidationError {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return true;
}

/**
 * Validate password strength (boolean return for backwards compatibility)
 * - At least 8 characters
 * - At least one uppercase, one lowercase, one number
 */
export function validatePassword(password: string): boolean {
  const result = validatePasswordStrength(password);
  return result === true;
}
