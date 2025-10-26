/**
 * Logger utility types and helpers
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Get log level from environment
 */
export function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  const validLevels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

  if (level && validLevels.includes(level as LogLevel)) {
    return level as LogLevel;
  }

  return "info";
}
