type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  component?: string;
  userId?: string | number;
  action?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private enabledLevels: Set<LogLevel>;

  constructor() {
    // In production, only log warnings and errors
    this.enabledLevels = this.isDevelopment
      ? new Set(["debug", "info", "warn", "error"])
      : new Set(["warn", "error"]);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const component = context?.component ? `[${context.component}]` : "";
    const userId = context?.userId ? `[User:${context.userId}]` : "";
    const action = context?.action ? `[${context.action}]` : "";

    return `${timestamp} ${level.toUpperCase()} ${component}${userId}${action} ${message}`;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: unknown
  ) {
    if (!this.enabledLevels.has(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case "debug":
        console.debug(formattedMessage, data ? data : "");
        break;
      case "info":
        console.info(formattedMessage, data ? data : "");
        break;
      case "warn":
        console.warn(formattedMessage, data ? data : "");
        break;
      case "error":
        console.error(formattedMessage, data ? data : "");
        // In production, you might want to send errors to monitoring service
        if (!this.isDevelopment && context?.metadata) {
          this.sendToMonitoring(level, message, context, data);
        }
        break;
    }
  }

  private sendToMonitoring(
    level: LogLevel,
    message: string,
    context: LogContext,
    data?: unknown
  ) {
    // Placeholder for sending to monitoring service (e.g., Sentry, LogRocket)
    // This prevents sensitive data from being logged in production
    if (this.isDevelopment) return;

    try {
      // Example: Send only non-sensitive error data to monitoring
      const sanitizedData = this.sanitizeData(data);
      // await sendToMonitoringService({ level, message, context, data: sanitizedData });
      void sanitizedData; // Acknowledge variable usage
    } catch {
      // Fail silently in production to avoid cascading errors
    }
  }

  private sanitizeData(data: unknown): unknown {
    if (!data) return data;

    // Remove sensitive information
    const sensitiveKeys = ["password", "token", "secret", "key", "auth"];
    const sanitized = JSON.parse(JSON.stringify(data));

    const removeSensitive = (obj: unknown): unknown => {
      if (typeof obj !== "object" || obj === null) return obj;

      const typedObj = obj as Record<string, unknown>;
      for (const key in typedObj) {
        if (
          sensitiveKeys.some((sensitive) =>
            key.toLowerCase().includes(sensitive)
          )
        ) {
          typedObj[key] = "[REDACTED]";
        } else if (typeof typedObj[key] === "object") {
          typedObj[key] = removeSensitive(typedObj[key]);
        }
      }
      return typedObj;
    };

    return removeSensitive(sanitized);
  }

  debug(message: string, context?: LogContext, data?: unknown) {
    this.log("debug", message, context, data);
  }

  info(message: string, context?: LogContext, data?: unknown) {
    this.log("info", message, context, data);
  }

  warn(message: string, context?: LogContext, data?: unknown) {
    this.log("warn", message, context, data);
  }

  error(message: string, context?: LogContext, data?: unknown) {
    this.log("error", message, context, data);
  }

  // Convenience methods for common scenarios
  apiCall(method: string, url: string, status?: number, context?: LogContext) {
    const message = `API ${method.toUpperCase()} ${url}${
      status ? ` - ${status}` : ""
    }`;
    if (status && status >= 400) {
      this.error(message, { ...context, action: "api_call" });
    } else {
      this.debug(message, { ...context, action: "api_call" });
    }
  }

  userAction(action: string, userId?: string, context?: LogContext) {
    this.info(`User action: ${action}`, {
      ...context,
      userId,
      action: "user_action",
    });
  }

  performance(operation: string, duration: number, context?: LogContext) {
    const message = `Performance: ${operation} took ${duration}ms`;
    if (duration > 1000) {
      this.warn(message, { ...context, action: "performance" });
    } else {
      this.debug(message, { ...context, action: "performance" });
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for use in components
export type { LogLevel, LogContext };
