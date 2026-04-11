import { log } from "./logger.ts";

export interface ApiErrorShape {
  message: string;
  code?: string;
  status?: number;
  retryable?: boolean;
}

export class ApiError extends Error implements ApiErrorShape {
  code?: string;
  status?: number;
  retryable?: boolean;

  constructor(payload: ApiErrorShape) {
    super(payload.message);
    this.code = payload.code;
    this.status = payload.status;
    this.retryable = payload.retryable;
  }
}

export interface RequestOptions extends RequestInit {
  retryCount?: number;
  retryDelayMs?: number;
}

export async function apiFetch<T = unknown>(input: RequestInfo | URL, init: RequestOptions = {}): Promise<T> {
  const { retryCount = 1, retryDelayMs = 800, ...rest } = init;

  const attempt = async (n: number): Promise<T> => {
    try {
      const res = await fetch(input, {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          ...(rest.headers || {}),
        },
      });

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

      if (!res.ok) {
        const apiError = new ApiError({
          message:
            (isJson && body && typeof body === "object" && (body as any).error) ||
            (typeof body === "string" && body) ||
            "Something went wrong. Please try again.",
          status: res.status,
          code: isJson && body && typeof body === "object" ? (body as any).code : undefined,
          retryable: res.status >= 500 || res.status === 408,
        });

        log({
          level: "error",
          message: "API request failed",
          context: {
            url: typeof input === "string" ? input : input.toString(),
            status: res.status,
            method: rest.method || "GET",
          },
          error: apiError,
        });

        if (apiError.retryable && n > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          return attempt(n - 1);
        }

        throw apiError;
      }

      return (body ?? null) as T;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;

      const isNetwork = err?.name === "TypeError" || !navigator.onLine;
      const wrapped = new ApiError({
        message: isNetwork
          ? "Network error. Please check your connection and try again."
          : "Something went wrong. Please try again.",
        code: isNetwork ? "NETWORK_ERROR" : "UNKNOWN_ERROR",
        retryable: isNetwork,
      });

      log({
        level: "error",
        message: "API request threw",
        context: {
          url: typeof input === "string" ? input : input.toString(),
          method: rest.method || "GET",
        },
        error: err,
      });

      if (wrapped.retryable && n > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        return attempt(n - 1);
      }

      throw wrapped;
    }
  };

  return attempt(retryCount);
}

