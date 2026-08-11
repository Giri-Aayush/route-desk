// Draft a client-ready reply from a verified check result. The model writes prose
// only; every claim comes from the result it is handed, so it cannot promise a route
// the engine marked blocked.

import type { CheckResult, Requirement } from "@/lib/engine/types";
import { getProvider } from "./provider";

const SYSTEM = `You are on rhino.fi's BD and sales team. Draft a short reply to a prospect, grounded strictly in the verified route check you are given.

Rules:
- Only say a route works if the check marks it clear. Never imply a blocked route is possible.
- For blocked routes, say plainly that rhino.fi cannot serve them today, and why.
- For routes that need an extension, name the extension and that it is available.
- Quote limits and costs only from the numbers in the check.
- Be specific, warm, and concise. Plain sentences, no markdown headings, no emojis.
- Do not include any internal or system XML tags in your reply.`;

function renderContext(
  requirement: Requirement,
  result: CheckResult,
  nameOf: (id: string) => string,
): string {
  const lines: string[] = [];
  lines.push(
    `The prospect wants funds to settle as ${requirement.settlementToken} on ${nameOf(
      requirement.settlementChain,
    )}. Arrival form: ${requirement.arrivalForm}.`,
  );
  lines.push("");
  lines.push(
    `Settlement: ${
      result.settlement.ok
        ? "supported"
        : `not possible — ${result.settlement.reason ?? "unsupported"}`
    }`,
  );
  lines.push("");
  lines.push("Routes checked:");
  for (const r of result.routes) {
    const where = `${r.depositToken} from ${nameOf(r.depositChain)}`;
    if (r.outcome === "clear") {
      const min = r.limits ? ` (min deposit $${r.limits.minUsd})` : "";
      lines.push(`- ${where}: CLEAR${min}`);
    } else if (r.outcome === "extension") {
      lines.push(`- ${where}: NEEDS EXTENSION — ${r.reason ?? ""}`);
    } else {
      lines.push(`- ${where}: NOT SUPPORTED — ${r.reason ?? ""}`);
    }
  }
  if (result.extensions.length > 0) {
    lines.push("");
    lines.push("Extensions this requirement would need:");
    for (const e of result.extensions) lines.push(`- ${e.name}: ${e.trigger}`);
  }
  lines.push("");
  lines.push(
    `Totals: ${result.summary.clear} clear, ${result.summary.extension} need an extension, ${result.summary.blocked} not supported.`,
  );
  return lines.join("\n");
}

export async function draftReply(input: {
  requirement: Requirement;
  result: CheckResult;
  nameOf: (id: string) => string;
}): Promise<string> {
  return getProvider().generate({
    system: SYSTEM,
    user: renderContext(input.requirement, input.result, input.nameOf),
    maxTokens: 4096,
  });
}
