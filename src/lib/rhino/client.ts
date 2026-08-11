// Server-side fetchers for the rhino.fi public API.
//
// Every call goes through Next's Data Cache with a per-endpoint revalidation
// window, keyed by URL. One upstream fetch per window serves every visitor, so a
// public tool does not multiply load on rhino.fi. These run in route handlers only.

import type {
  RhinoBridgeConfigs,
  RhinoSwapTokenConfigs,
  RhinoSdaSupportedTokens,
  RhinoQuote,
} from "./types";

const API_BASE = process.env.RHINO_API_BASE ?? "https://api.rhino.fi";

// Thrown on any non-2xx from rhino.fi. `status` lets callers separate a bad
// request (a real "this route is not supported" answer) from an outage.
export class RhinoApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`rhino.fi ${path} responded ${status}`);
    this.name = "RhinoApiError";
  }
}

async function getJson<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new RhinoApiError(path, res.status, body);
  }
  return res.json() as Promise<T>;
}

// Chains and tokens. rhino.fi's architecture page calls this the source of truth
// for bridging. Changes rarely, so a long window.
export function getBridgeConfigs(): Promise<RhinoBridgeConfigs> {
  return getJson("/bridge/configs", 3600);
}

// The swappable token set per chain (broader than the bridge config token map).
export function getSwapTokenConfigs(): Promise<RhinoSwapTokenConfigs> {
  return getJson("/bridge/bridge-swap-token-configs", 3600);
}

// Which tokens a deposit address on `depositChain` can receive when it settles to
// `destinationChain`, with per-token USD min and max. Keyed by the pair.
export function getSdaSupportedTokens(
  depositChain: string,
  destinationChain: string,
): Promise<RhinoSdaSupportedTokens> {
  const path = `/sda/deposit-addresses/${encodeURIComponent(depositChain)}/${encodeURIComponent(destinationChain)}/supported-tokens`;
  return getJson(path, 600);
}

export interface QuoteParams {
  chainIn: string;
  chainOut: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  mode: "pay" | "receive";
  isSda?: boolean;
}

// A real quote with exact fees. Short window since fees move.
export function getQuote(p: QuoteParams): Promise<RhinoQuote> {
  const q = new URLSearchParams({
    chainIn: p.chainIn,
    chainOut: p.chainOut,
    tokenIn: p.tokenIn,
    tokenOut: p.tokenOut,
    amount: p.amount,
    mode: p.mode,
  });
  if (p.isSda) q.set("isSda", "true");
  return getJson(`/bridge/quote/bridge-swap/public?${q.toString()}`, 30);
}
