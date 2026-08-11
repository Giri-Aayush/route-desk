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
