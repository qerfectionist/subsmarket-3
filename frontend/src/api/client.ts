import { authHeaders } from "./dev";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "" : "http://localhost:8000");
const pendingIdempotency = new Map<string, { fingerprint: string; key: string }>();

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail = await response.text();
    try {
      const json = JSON.parse(detail) as { detail?: unknown };
      detail =
        typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
    } catch {
      // Keep raw response text.
    }
    throw new Error(`API ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function post<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers
  });
}

function createIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function postIdempotent<T>(
  scope: string,
  path: string,
  body?: unknown
): Promise<T> {
  const fingerprint = JSON.stringify(body ?? null);
  const pending = pendingIdempotency.get(scope);
  const key =
    pending?.fingerprint === fingerprint ? pending.key : createIdempotencyKey();
  pendingIdempotency.set(scope, { fingerprint, key });
  const result = await post<T>(path, body, { "Idempotency-Key": key });
  if (pendingIdempotency.get(scope)?.key === key) {
    pendingIdempotency.delete(scope);
  }
  return result;
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export async function patchIdempotent<T>(
  scope: string,
  path: string,
  body: unknown
): Promise<T> {
  const fingerprint = JSON.stringify(body ?? null);
  const pending = pendingIdempotency.get(scope);
  const key =
    pending?.fingerprint === fingerprint ? pending.key : createIdempotencyKey();
  pendingIdempotency.set(scope, { fingerprint, key });
  const result = await request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": key }
  });
  if (pendingIdempotency.get(scope)?.key === key) {
    pendingIdempotency.delete(scope);
  }
  return result;
}
