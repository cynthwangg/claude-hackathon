"use client";

export class ApiError extends Error {
  constructor(public key: string, public status: number) {
    super(key);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error_key?: string }).error_key ?? "error.generic", res.status);
  return data as T;
}

export const errorKey = (e: unknown) => (e instanceof ApiError ? (e.key === "notconfigured" ? "notconfigured" : "error.generic") : "error.generic");
