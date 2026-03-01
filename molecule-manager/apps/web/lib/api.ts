const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Error type ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidation() {
    return this.status === 422;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include", // send session cookie with every request
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  // 204 No Content — return undefined without trying to parse JSON
  if (res.status === 204) return undefined as T;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { detail: res.statusText };
  }

  if (!res.ok) {
    const detail =
      typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : "Request failed";
    throw new ApiError(res.status, detail);
  }

  return data as T;
}

// ─── Public API client ────────────────────────────────────────────────────────

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};
