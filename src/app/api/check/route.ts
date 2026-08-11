// POST /api/check
// Body: a Requirement plus an optional amountUsd. Fetches the catalog and one SDA
// lookup per deposit chain (settling to the settlement chain), then runs the pure
// check. Returns the verdict grid, the extensions the request forces, and a summary.

import { NextResponse } from "next/server";
import { recordCheck } from "@/lib/analytics/store";
import { buildCatalog } from "@/lib/engine/catalog";
import { runCheck, type SdaByDepositChain } from "@/lib/engine/check";
import type { Requirement } from "@/lib/engine/types";
import {
  getBridgeConfigs,
  getSdaSupportedTokens,
  RhinoApiError,
} from "@/lib/rhino/client";

const DEFAULT_AMOUNT_USD = 1000;

type ParseResult =
  | { requirement: Requirement; amountUsd?: number }
  | { error: string };

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function parseRequirement(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { error: "body must be an object" };
  }
  const b = body as Record<string, unknown>;

  if (!isStringArray(b.depositChains) || b.depositChains.length === 0) {
    return { error: "depositChains must be a non-empty string array" };
  }
  if (!isStringArray(b.depositTokens) || b.depositTokens.length === 0) {
    return { error: "depositTokens must be a non-empty string array" };
  }
  if (typeof b.settlementChain !== "string" || b.settlementChain === "") {
    return { error: "settlementChain is required" };
  }
  if (typeof b.settlementToken !== "string" || b.settlementToken === "") {
    return { error: "settlementToken is required" };
  }

  const arrivalForm = b.arrivalForm;
  if (
    arrivalForm !== "balance" &&
    arrivalForm !== "vault" &&
    arrivalForm !== "contract-call"
  ) {
    return { error: "arrivalForm must be balance, vault, or contract-call" };
  }

  const c = (b.commercial ?? {}) as Record<string, unknown>;
  const commercial = {
    guaranteedRate: Boolean(c.guaranteedRate),
    clientSurcharge: Boolean(c.clientSurcharge),
    enhancedScreening: Boolean(c.enhancedScreening),
  };

  let amountUsd: number | undefined;
  if (b.amountUsd !== undefined) {
    if (
      typeof b.amountUsd !== "number" ||
      !Number.isFinite(b.amountUsd) ||
      b.amountUsd <= 0
    ) {
      return { error: "amountUsd must be a positive number" };
    }
    amountUsd = b.amountUsd;
  }

  return {
    requirement: {
      depositChains: b.depositChains,
      depositTokens: b.depositTokens,
      settlementChain: b.settlementChain,
      settlementToken: b.settlementToken,
      arrivalForm,
      commercial,
    },
    amountUsd,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parseRequirement(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { requirement, amountUsd } = parsed;

  try {
    const configs = await getBridgeConfigs();
    const catalog = buildCatalog(configs, new Date().toISOString());

    // One SDA lookup per deposit chain, settling to the settlement chain. A chain
    // that cannot mint an SDA, or whose lookup returns a 4xx, maps to null, which
    // the engine reads as Custom Chain & Token Support rather than an error.
    const sdaByDepositChain: SdaByDepositChain = {};
    await Promise.all(
      requirement.depositChains.map(async (chainId) => {
        if (!catalog.chains[chainId]?.canMintSda) {
          sdaByDepositChain[chainId] = null;
          return;
        }
        try {
          const res = await getSdaSupportedTokens(
            chainId,
            requirement.settlementChain,
          );
          sdaByDepositChain[chainId] = res.supportedTokens;
        } catch (err) {
          if (
            err instanceof RhinoApiError &&
            err.status >= 400 &&
            err.status < 500
          ) {
            sdaByDepositChain[chainId] = null;
            return;
          }
          throw err;
        }
      }),
    );

    const result = runCheck({
      requirement,
      catalog,
      sdaByDepositChain,
      representativeAmountUsd: amountUsd ?? DEFAULT_AMOUNT_USD,
    });

    // Capture the check for demand analytics. Best-effort: a store failure must
    // never break the check itself, so this is fire-and-forget.
    void recordCheck({
      at: new Date().toISOString(),
      settlementChain: requirement.settlementChain,
      settlementToken: requirement.settlementToken,
      amountUsd,
      routes: result.routes.map((r) => ({
        chain: r.depositChain,
        token: r.depositToken,
        outcome: r.outcome,
        reason: r.reason,
      })),
      extensions: result.extensions.map((e) => e.name),
    }).catch(() => {});

    return NextResponse.json({ ...result, fetchedAt: catalog.fetchedAt });
  } catch (err) {
    if (err instanceof RhinoApiError) {
      return NextResponse.json(
        { error: "rhino.fi is unavailable, so the check cannot be completed" },
        { status: 502 },
      );
    }
    throw err;
  }
}
