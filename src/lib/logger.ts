type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  message: string;
  level?: LogLevel;
  context?: Record<string, unknown>;
  error?: unknown;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function log({ message, level = "info", context, error }: LogPayload) {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  const details = {
    ...(context ?? {}),
    error: error ? formatError(error) : undefined,
  };

  if (level === "error" || level === "warn") {
    console.error(base, details);
  } else {
    console.log(base, details);
  }

  // Hook for future: send to remote logging / Sentry etc.
}

export function logCriticalAction(action: string, context?: Record<string, unknown>) {
  log({ message: `CRITICAL_ACTION: ${action}`, level: "info", context });
}

