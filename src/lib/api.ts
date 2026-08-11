// Client-side wrappers for the app's own route handlers. The browser only ever
// talks to these, never to rhino.fi directly.

import type { Catalog } from "@/lib/engine/catalog";
import type { CheckResult, Requirement } from "@/lib/engine/types";
import type { RhinoQuote } from "@/lib/rhino/types";

export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  const res = await fetch("/api/catalog", { signal });
  if (!res.ok) throw new Error("The route data is unavailable right now.");
  return res.json();
}

export type CheckResponse = CheckResult & { fetchedAt: string };

export async function fetchCheck(
  requirement: Requirement & { amountUsd?: number },
  signal?: AbortSignal,
): Promise<CheckResponse> {
  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requirement),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "The check could not be completed.");
  }
  return res.json();
}

export type QuoteResponse =
  | { available: true; quote: RhinoQuote; fetchedAt: string }
  | { available: false; reason: string };

export interface QuoteArgs {
  chainIn: string;
  chainOut: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  isSda?: boolean;
}

export async function fetchQuote(
  args: QuoteArgs,
  signal?: AbortSignal,
): Promise<QuoteResponse> {
  const q = new URLSearchParams({
    chainIn: args.chainIn,
    chainOut: args.chainOut,
    tokenIn: args.tokenIn,
    tokenOut: args.tokenOut,
    amount: args.amount,
    mode: "pay",
  });
  if (args.isSda) q.set("isSda", "true");
  const res = await fetch(`/api/quote?${q.toString()}`, { signal });
  if (!res.ok) throw new Error("Quote unavailable.");
  return res.json();
}

// The AI workspace routes. Distinguished from ordinary failures so the UI can show
// a "set an API key" state rather than a generic error.
export class AiUnconfiguredError extends Error {
  constructor() {
    super("The AI workspace is not configured.");
    this.name = "AiUnconfiguredError";
  }
}

async function aiError(res: Response, fallback: string): Promise<Error> {
  if (res.status === 503) return new AiUnconfiguredError();
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? fallback);
}

export async function fetchAiStatus(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/api/ai/status", { signal });
    if (!res.ok) return false;
    const body = (await res.json()) as { configured?: boolean };
    return Boolean(body.configured);
  } catch {
    return false;
  }
}

export interface AiParseResponse {
  requirement: Requirement;
  amountUsd: number | null;
  notes: string;
  unmapped: string[];
}

export async function fetchAiParse(
  message: string,
  signal?: AbortSignal,
): Promise<AiParseResponse> {
  const res = await fetch("/api/ai/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok) throw await aiError(res, "The message could not be parsed.");
  return res.json();
}

export async function fetchAiReply(
  input: {
    requirement: Requirement;
    result: CheckResult;
    names: Record<string, string>;
  },
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/ai/reply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw await aiError(res, "The reply could not be drafted.");
  const body = (await res.json()) as { text: string };
  return body.text;
}

export async function fetchAiBrief(signal?: AbortSignal): Promise<string> {
  const res = await fetch("/api/ai/brief", { method: "POST", signal });
  if (!res.ok) throw await aiError(res, "The brief could not be drafted.");
  const body = (await res.json()) as { text: string };
  return body.text;
}
