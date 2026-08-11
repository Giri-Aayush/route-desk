// Domain types for the route checker. These are the app's own model, independent
// of the raw rhino.fi API shapes in ../rhino/types.

// What the funds should become when they settle. Anything other than a plain
// balance forces the Automated Onchain Actions extension.
export type ArrivalForm = "balance" | "vault" | "contract-call";

export interface Commercial {
  // A guaranteed conversion rate (USDT<->USDC 1:1) forces 1:1 Stablecoin Swaps.
  guaranteedRate: boolean;
  // A surcharge on top of rhino fees forces Advanced Fee & Limit Management.
  clientSurcharge: boolean;
  // Screening beyond the standard set forces Enhanced Compliance & Risk Management.
  enhancedScreening: boolean;
}

export interface Requirement {
  depositChains: string[]; // chain ids, e.g. "ETHEREUM"
  depositTokens: string[]; // canonical symbols, e.g. "USDC"
  settlementChain: string;
  settlementToken: string;
  arrivalForm: ArrivalForm;
  commercial: Commercial;
}

export type Outcome = "clear" | "extension" | "blocked";

export type ExtensionId =
  | "tron-access"
  | "custom-chain-token"
  | "stablecoin-swaps"
  | "onchain-actions"
  | "fee-limit-management"
  | "compliance";

export interface ExtensionNeed {
  id: ExtensionId;
  name: string;
  // The specific part of the request that triggered this extension.
  trigger: string;
}

export interface RouteVerdict {
  depositChain: string;
  depositToken: string;
  outcome: Outcome;
  // Present for "extension" and "blocked", in plain words.
  reason?: string;
  // The chain-specific extension that unblocks this cell, if any.
  extension?: ExtensionId;
  // Deposit min and max in USD, when the route reaches a Smart Deposit Address.
  limits?: { minUsd: number; maxUsd: number };
}

export interface SettlementVerdict {
  ok: boolean;
  reason?: string;
}

export interface CheckResult {
  settlement: SettlementVerdict;
  routes: RouteVerdict[];
  extensions: ExtensionNeed[];
  summary: { clear: number; extension: number; blocked: number };
}
