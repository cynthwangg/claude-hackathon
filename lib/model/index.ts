import { anthropicProvider } from "./anthropic";
import { mockProvider } from "./mock";
import type { ModelProvider } from "./types";

export class NotConfigured extends Error {}

/** The demo path is the real model. The mock exists for tests and is never a silent fallback. */
export function provider(): ModelProvider {
  const which = process.env.MODEL_PROVIDER ?? "anthropic";
  if (which === "mock") return mockProvider;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) throw new NotConfigured("ANTHROPIC_API_KEY is not set");
  return anthropicProvider;
}

export const isMock = () => (process.env.MODEL_PROVIDER ?? "anthropic") === "mock";
