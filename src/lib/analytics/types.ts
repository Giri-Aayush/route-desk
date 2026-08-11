import type { Outcome } from "@/lib/engine/types";

// One captured check, written per /api/check call. Requirement plus the outcome of
// every route, which is what the demand aggregation reads.
export interface CheckEvent {
  at: string; // ISO timestamp
  settlementChain: string;
  settlementToken: string;
  amountUsd?: number;
  routes: {
    chain: string;
    token: string;
    outcome: Outcome;
    reason?: string;
  }[];
  extensions: string[]; // extension names the request triggered
}

// A (chain, token) pair with how often it came up, for demand rankings.
export interface DemandRow {
  chain: string;
  token: string;
  count: number;
  reason?: string;
}

export interface CountRow {
  key: string;
  count: number;
}

export interface Insights {
  totalChecks: number;
  totalRoutes: number;
  clearRate: number; // 0..1
  since: string | null;
  // Requested but blocked, ranked. The strongest "build this" signals.
  unmetDemand: DemandRow[];
  // Requested but gated behind a paid extension, ranked.
  needsExtension: DemandRow[];
  topDepositChains: CountRow[];
  topDepositTokens: CountRow[];
  topSettlements: DemandRow[];
  topExtensions: CountRow[];
}
