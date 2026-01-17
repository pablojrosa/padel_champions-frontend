import { getToken, clearToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE) {
  // This will show clearly during dev build
  // eslint-disable-next-line no-console
  console.warn("Missing NEXT_PUBLIC_API_URL env var");
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T>(
  path: string,
  opts?: {
    method?: HttpMethod;
    body?: unknown;
    auth?: boolean;
    signal?: AbortSignal;
  }
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = opts?.method ?? "GET";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (opts?.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    signal: opts?.signal,
    cache: "no-store",
  });

  // Handle 401 globally
  if (res.status === 401) {
    clearToken();
    throw new ApiError("Unauthorized", 401);
  }

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const msg =
      (data && (data.message || data.detail)) ||
      `Request failed (${res.status})`;
    throw new ApiError(String(msg), res.status, data);
  }

  return data as T;
}

export async function apiMaybe<T>(
  path: string,
  opts?: {
    method?: HttpMethod;
    body?: unknown;
    auth?: boolean;
    signal?: AbortSignal;
  }
): Promise<T | null> {
  try {
    return await api<T>(path, opts);
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}
