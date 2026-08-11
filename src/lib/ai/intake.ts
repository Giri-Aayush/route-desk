// Turn a prospect's plain-English message into a structured requirement. Claude
// maps the language to chain IDs and token symbols; we then intersect the result
// with the live catalog, so a chain or token the model invents is dropped and
// surfaced as "unmapped" rather than fed into the check. Feasibility is never
// decided here - that is /api/check on the requirement this returns.

import type { Catalog } from "@/lib/engine/catalog";
import type { ArrivalForm, Requirement } from "@/lib/engine/types";
import { AI_MODEL, aiClient, firstText } from "./client";

export interface ParsedIntake {
  requirement: Requirement;
  amountUsd: number | null;
  // One or two sentences from the model on assumptions or ambiguity.
  notes: string;
  // Chains or tokens the prospect named that are not in the live catalog.
  unmapped: string[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    depositChains: {
      type: "array",
      items: { type: "string" },
      description: "Chain IDs the funds come from, mapped from the valid list.",
    },
    depositTokens: {
      type: "array",
      items: { type: "string" },
      description: "Token symbols the deposits are in, from the valid list.",
    },
    settlementChain: {
      type: "string",
      description: "Chain ID where funds should settle.",
    },
    settlementToken: {
      type: "string",
      description: "Token symbol funds should become on arrival.",
    },
    arrivalForm: {
      type: "string",
      enum: ["balance", "vault", "contract-call"],
      description:
        "What funds become: a plain balance, a vault deposit, or a contract call.",
    },
    commercial: {
      type: "object",
      additionalProperties: false,
      properties: {
        guaranteedRate: {
          type: "boolean",
          description: "They need a guaranteed 1:1 stablecoin conversion.",
        },
        clientSurcharge: {
          type: "boolean",
          description: "They want to add their own fee on top of rhino's.",
        },
        enhancedScreening: {
          type: "boolean",
          description: "They need screening beyond the standard compliance set.",
        },
      },
      required: ["guaranteedRate", "clientSurcharge", "enhancedScreening"],
    },
    amountUsd: {
      anyOf: [{ type: "number" }, { type: "null" }],
      description: "Representative transfer size in USD if stated, else null.",
    },
    unmapped: {
      type: "array",
      items: { type: "string" },
      description: "Chains or tokens they named that are not in the valid lists.",
    },
    notes: {
      type: "string",
      description: "One or two sentences on assumptions or ambiguity, else empty.",
    },
  },
  required: [
    "depositChains",
    "depositTokens",
    "settlementChain",
    "settlementToken",
    "arrivalForm",
    "commercial",
    "amountUsd",
    "unmapped",
    "notes",
  ],
} as const;

const SYSTEM = `You read a prospect's plain-English description of a payments or treasury flow and turn it into a structured routing requirement for rhino.fi's Route Desk.

Rules:
- Map chain names to the exact chain IDs in the list you are given (for example "Polygon" is "MATIC_POS"). Only use IDs and token symbols from the lists.
- If the prospect names a chain or token that is not in the lists, add it to "unmapped" and leave it out of the requirement.
- depositChains are where funds come from; settlementChain and settlementToken are what funds should become on arrival.
- arrivalForm is "balance" unless they clearly want a vault deposit ("vault") or an on-chain contract call on arrival ("contract-call").
- Set a commercial flag only when the prospect explicitly asks for that thing.
- You do not decide whether any route is supported. You only extract what they asked for; a later step checks feasibility against live data.`;

function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function safeParse(text: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Validate the model's output against the live catalog. Unknown chains and tokens
// are dropped from the requirement and collected into unmapped.
function coerce(
  raw: Record<string, unknown>,
  catalog: Catalog,
  knownTokens: Set<string>,
): ParsedIntake {
  const unmapped = new Set(stringArray(raw.unmapped));

  const depositChains = stringArray(raw.depositChains).filter((id) => {
    if (catalog.chains[id]) return true;
    unmapped.add(id);
    return false;
  });
  const depositTokens = stringArray(raw.depositTokens).filter((sym) => {
    if (knownTokens.has(sym)) return true;
    unmapped.add(sym);
    return false;
  });

  const settlementChain =
    typeof raw.settlementChain === "string" ? raw.settlementChain : "";
  const settlementToken =
    typeof raw.settlementToken === "string" ? raw.settlementToken : "";
  if (settlementChain && !catalog.chains[settlementChain]) {
    unmapped.add(settlementChain);
  }

  const af = raw.arrivalForm;
  const arrivalForm: ArrivalForm =
    af === "vault" || af === "contract-call" ? af : "balance";

  const c = (raw.commercial ?? {}) as Record<string, unknown>;
  const commercial = {
    guaranteedRate: Boolean(c.guaranteedRate),
    clientSurcharge: Boolean(c.clientSurcharge),
    enhancedScreening: Boolean(c.enhancedScreening),
  };

  const amountUsd =
    typeof raw.amountUsd === "number" &&
    Number.isFinite(raw.amountUsd) &&
    raw.amountUsd > 0
      ? raw.amountUsd
      : null;

  const notes = typeof raw.notes === "string" ? raw.notes : "";

  return {
    requirement: {
      depositChains,
      depositTokens,
      settlementChain,
      settlementToken,
      arrivalForm,
      commercial,
    },
    amountUsd,
    notes,
    unmapped: [...unmapped],
  };
}

export async function parseIntake(
  message: string,
  catalog: Catalog,
): Promise<ParsedIntake> {
  const chains = Object.values(catalog.chains)
    .filter((c) => c.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));

  const knownTokens = new Set<string>();
  for (const c of chains) {
    for (const symbol of Object.keys(c.tokens)) knownTokens.add(symbol);
  }

  const chainList = chains.map((c) => `${c.id} — ${c.name}`).join("\n");
  const tokenList = [...knownTokens].sort().join(", ");

  const user = `Valid deposit chains (ID — name):
${chainList}

Valid token symbols:
${tokenList}

Prospect's message:
"""
${message.trim()}
"""`;

  const response = await aiClient().messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    output_config: {
      format: { type: "json_schema", schema: SCHEMA },
      effort: "low",
    },
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  return coerce(safeParse(firstText(response)), catalog, knownTokens);
}
