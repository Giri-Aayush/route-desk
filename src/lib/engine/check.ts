// The route check. Pure logic over a catalog and per-pair SDA data, so it runs the
// same in a test, a route handler, or the browser. Network access lives in the
// callers; this module only decides.

import type { RhinoSdaSupportedToken } from "../rhino/types";
import type { Catalog } from "./catalog";
import { deriveExtensions, TRON_CHAIN_ID } from "./extensions";
import type {
  CheckResult,
  Requirement,
  RouteVerdict,
  SettlementVerdict,
} from "./types";

// SDA supported tokens for each deposit chain, all settling to the requirement's
// settlement chain. `null` means the chain cannot mint a Smart Deposit Address (or
// the per-pair lookup returned nothing), which routes it to Custom Chain & Token
// Support rather than a flat "no".
export type SdaByDepositChain = Record<string, RhinoSdaSupportedToken[] | null>;

export interface CheckInputs {
  requirement: Requirement;
  catalog: Catalog;
  sdaByDepositChain: SdaByDepositChain;
  // Representative deposit size used for the min/max limit check and quotes.
  representativeAmountUsd: number;
}

// ETH is a source asset only; it can never be a settlement (destination) asset.
// Documented on the Supported Chains page.
const ETH = "ETH";

export function checkSettlement(
  req: Requirement,
  catalog: Catalog,
): SettlementVerdict {
  const chain = catalog.chains[req.settlementChain];
  if (!chain) {
    return {
      ok: false,
      reason: `${req.settlementChain} is not a supported chain`,
    };
  }
  if (req.settlementToken === ETH) {
    return {
      ok: false,
      reason: "ETH can only be a source asset, not a settlement asset",
    };
  }
  if (!chain.tokens[req.settlementToken]) {
    return {
      ok: false,
      reason: `${req.settlementToken} is not supported on ${chain.name}`,
    };
  }
  return { ok: true };
}

function evaluateRoute(
  inputs: CheckInputs,
  depositChain: string,
  depositToken: string,
): RouteVerdict {
  const { catalog, sdaByDepositChain, representativeAmountUsd } = inputs;
  const base = { depositChain, depositToken };
  const chain = catalog.chains[depositChain];

  if (!chain) {
    return {
      ...base,
      outcome: "blocked",
      reason: `${depositChain} is not a supported chain`,
    };
  }

  // A chain that cannot mint a deposit address is not a flat no. rhino can add it
  // through Custom Chain & Token Support, so this is a route to a conversation.
  const sdaTokens = sdaByDepositChain[depositChain];
  if (!chain.canMintSda || sdaTokens == null) {
    return {
      ...base,
      outcome: "extension",
      extension: "custom-chain-token",
      reason: `${chain.name} cannot mint a Smart Deposit Address; needs Custom Chain & Token Support`,
    };
  }

  const supported = sdaTokens.find((t) => t.symbol === depositToken);
  if (!supported) {
    return {
      ...base,
      outcome: "blocked",
      reason: `${depositToken} cannot be deposited to a Smart Deposit Address on ${chain.name}`,
    };
  }

  const limits = {
    minUsd: supported.minDepositLimitUsd,
    maxUsd: supported.maxDepositLimitUsd,
  };

  // A route that is technically supported but sits under the minimum is a false
  // yes if shown as clear. Catch it here.
  if (representativeAmountUsd < supported.minDepositLimitUsd) {
    return {
      ...base,
      outcome: "blocked",
      limits,
      reason: `Below the ${supported.minDepositLimitUsd} USD minimum on ${chain.name}`,
    };
  }
  if (representativeAmountUsd > supported.maxDepositLimitUsd) {
    return {
      ...base,
      outcome: "blocked",
      limits,
      reason: `Above the ${supported.maxDepositLimitUsd} USD maximum on ${chain.name}`,
    };
  }

  if (depositChain === TRON_CHAIN_ID) {
    return {
      ...base,
      outcome: "extension",
      extension: "tron-access",
      limits,
      reason: "Tron deposits require the Tron Access extension",
    };
  }

  return { ...base, outcome: "clear", limits };
}

export function runCheck(inputs: CheckInputs): CheckResult {
  const { requirement, catalog } = inputs;
  const settlement = checkSettlement(requirement, catalog);

  const routes: RouteVerdict[] = [];
  for (const depositChain of requirement.depositChains) {
    for (const depositToken of requirement.depositTokens) {
      // If the settlement leg is broken, nothing downstream can complete, so no
      // cell is allowed to read as clear.
      const verdict: RouteVerdict = settlement.ok
        ? evaluateRoute(inputs, depositChain, depositToken)
        : { depositChain, depositToken, outcome: "blocked", reason: settlement.reason };
      routes.push(verdict);
    }
  }

  const extensions = deriveExtensions(requirement, catalog);
  const summary = {
    clear: routes.filter((r) => r.outcome === "clear").length,
    extension: routes.filter((r) => r.outcome === "extension").length,
    blocked: routes.filter((r) => r.outcome === "blocked").length,
  };

  return { settlement, routes, extensions, summary };
}
