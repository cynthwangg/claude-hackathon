import { NextResponse } from "next/server";
import { ModelError } from "./model/anthropic";
import { NotConfigured } from "./model";

export type Ctx<P> = { params: Promise<P> };

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error_key: string, status: number) {
  return NextResponse.json({ error_key }, { status });
}

/** Errors return {error_key}; the UI maps keys to copy in her language. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotConfigured) return fail("notconfigured", 503);
    if (e instanceof ModelError) return fail("error.generic", 502);
    const msg = e instanceof Error ? e.message : "";
    if (msg.endsWith("_not_found")) return fail("not_found", 404);
    if (["unsupported_type", "read_only", "not_a_stated_key", "bad_state", "bad_value"].includes(msg)) return fail(msg, 400);
    console.error(e);
    return fail("error.generic", 500);
  }
}
