import { logger } from "./logger";

/**
 * Security utilities for input validation and sanitization
 */

// XSS Prevention
export const sanitizeInput = (input: string): string => {
  if (typeof input !== "string") return "";

  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

// SQL Injection Prevention (for client-side validation)
export const validateSqlSafeString = (input: string): boolean => {
  const sqlKeywords = [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "EXEC",
    "EXECUTE",
    "UNION",
    "SCRIPT",
    "JAVASCRIPT",
    "VBSCRIPT",
  ];

  const upperInput = input.toUpperCase();
  return !sqlKeywords.some((keyword) => upperInput.includes(keyword));
};

// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Password strength validation
export const validatePasswordStrength = (
  password: string
): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  // Check for spaces
  if (/\s/.test(password)) {
    feedback.push("Password cannot contain spaces");
    return {
      isValid: false,
      score: 0,
      feedback,
    };
  }

  // Length check (minimum 8 characters)
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push("Password must be at least 8 characters long");
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password must contain at least one uppercase letter (A-Z)");
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password must contain at least one lowercase letter (a-z)");
  }

  // Special character check - including !@ and more
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    score += 1;
  } else {
    feedback.push(
      "Password must contain at least one special character (!@#$%^&* etc.)"
    );
  }

  // Common password check
  const commonPasswords = [
    "password",
    "123456",
    "123456789",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "monkey",
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    score = 0;
    feedback.push("Password is too common, please choose a stronger password");
  }

  // All 4 criteria must be met for valid password
  return {
    isValid: score >= 4 && !/\s/.test(password),
    score,
    feedback,
  };
};

// File upload validation
export const validateFileUpload = (
  file: File
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

  // Size check
  if (file.size > maxSize) {
    errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
  }

  // Type check
  if (!allowedTypes.includes(file.type)) {
    errors.push("File type must be JPEG, PNG, or GIF");
  }

  // Name check
  if (file.name.length > 255) {
    errors.push("File name is too long");
  }

  // Malicious name check
  const dangerousPatterns = [
    /\.\./, // Directory traversal
    /[<>:"|?*]/, // Invalid characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Reserved names
  ];

  if (dangerousPatterns.some((pattern) => pattern.test(file.name))) {
    errors.push("File name contains invalid characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Rate limiting helper (client-side)
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      logger.warn("Rate limit exceeded", {
        component: "RateLimiter",
        action: "rate_limit_exceeded",
        metadata: {
          key,
          requests: validRequests.length,
          maxRequests: this.maxRequests,
        },
      });
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

// Content Security Policy helpers
export const generateCSPNonce = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

// Input sanitization for different contexts
export const sanitizeForHTML = (input: string): string => {
  return sanitizeInput(input);
};

export const sanitizeForURL = (input: string): string => {
  return encodeURIComponent(input);
};

export const sanitizeForJSON = (input: string): string => {
  return JSON.stringify(input).slice(1, -1); // Remove quotes
};

// Secure random string generation
export const generateSecureToken = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

// CSRF token validation
export const validateCSRFToken = (
  token: string,
  expectedToken: string
): boolean => {
  if (!token || !expectedToken) return false;

  // Constant-time comparison to prevent timing attacks
  if (token.length !== expectedToken.length) return false;

  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }

  return result === 0;
};

// Security headers validation
export const validateSecurityHeaders = (
  headers: Record<string, string>
): {
  isSecure: boolean;
  missing: string[];
  recommendations: string[];
} => {
  const requiredHeaders = [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-XSS-Protection",
    "Strict-Transport-Security",
  ];

  const missing = requiredHeaders.filter((header) => !headers[header]);
  const recommendations: string[] = [];

  if (!headers["Content-Security-Policy"]) {
    recommendations.push("Add Content-Security-Policy header");
  }

  if (!headers["Referrer-Policy"]) {
    recommendations.push("Add Referrer-Policy header");
  }

  return {
    isSecure: missing.length === 0,
    missing,
    recommendations,
  };
};

// Export singleton rate limiter instances
export const apiRateLimiter = new RateLimiter(30, 60000); // 30 requests per minute
export const authRateLimiter = new RateLimiter(5, 300000); // 5 auth attempts per 5 minutes
