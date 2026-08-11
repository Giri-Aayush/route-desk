// Extension derivation. rhino.fi's paid extensions are forced by the shape of a
// request, not by any single route. This maps the whole requirement to the
// extensions it needs, each tied to the trigger that caused it.

import type { Catalog } from "./catalog";
import type { ExtensionId, ExtensionNeed, Requirement } from "./types";

export const TRON_CHAIN_ID = "TRON";

export const EXTENSION_NAMES: Record<ExtensionId, string> = {
  "tron-access": "Tron Access",
  "custom-chain-token": "Custom Chain & Token Support",
  "stablecoin-swaps": "1:1 Stablecoin Swaps",
  "onchain-actions": "Automated Onchain Actions",
  "fee-limit-management": "Advanced Fee & Limit Management",
  compliance: "Enhanced Compliance & Risk Management",
};

const ARRIVAL_LABEL: Record<string, string> = {
  vault: "vault position",
  "contract-call": "contract call",
};

export function deriveExtensions(
  req: Requirement,
  catalog: Catalog,
): ExtensionNeed[] {
  const needs: ExtensionNeed[] = [];
  const add = (id: ExtensionId, trigger: string) =>
    needs.push({ id, name: EXTENSION_NAMES[id], trigger });

  if (req.depositChains.includes(TRON_CHAIN_ID)) {
    add("tron-access", "Tron is among the deposit chains");
  }

  const nonSda = req.depositChains.filter(
    (id) => !catalog.chains[id]?.canMintSda,
  );
  if (nonSda.length > 0) {
    const names = nonSda.map((id) => catalog.chains[id]?.name ?? id).join(", ");
    const noun = nonSda.length > 1 ? "chains" : "chain";
    add(
      "custom-chain-token",
      `Deposit ${noun} without a Smart Deposit Address: ${names}`,
    );
  }

  if (req.commercial.guaranteedRate) {
    add("stablecoin-swaps", "A guaranteed conversion rate is required");
  }

  if (req.arrivalForm !== "balance") {
    const label = ARRIVAL_LABEL[req.arrivalForm] ?? req.arrivalForm;
    add("onchain-actions", `Funds should arrive as a ${label}, not a balance`);
  }

  if (req.commercial.clientSurcharge) {
    add("fee-limit-management", "A client surcharge is applied on top of rhino fees");
  }

  if (req.commercial.enhancedScreening) {
    add("compliance", "Screening beyond the standard set is required");
  }

  return needs;
}
