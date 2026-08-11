// Draft a short demand brief for the BD and sales team from the aggregated check
// analytics. The numbers are computed deterministically; the model only turns them
// into a readable brief with a recommendation.

import type { Insights } from "@/lib/analytics/types";
import { getProvider } from "./provider";

const SYSTEM = `You write a short demand brief for rhino.fi's BD and sales team from real Route Desk usage.

Rules:
- Lead with the single strongest build signal: the route with the most demand that rhino.fi cannot serve today.
- Be specific with the numbers you are given. Do not invent data.
- Recommend where to focus: routes to build (unmet demand), extensions to upsell (gated demand), and where the volume is.
- A few tight paragraphs. No preamble, no markdown headings, no emojis.`;

function renderInsights(insights: Insights, nameOf: (id: string) => string): string {
  const lines: string[] = [];
  lines.push(
    `${insights.totalChecks} checks, ${insights.totalRoutes} routes, ${Math.round(
      insights.clearRate * 100,
    )}% clear.`,
  );

  lines.push("");
  lines.push("Requested but not supported (build signals):");
  if (insights.unmetDemand.length === 0) {
    lines.push("- none");
  } else {
    for (const r of insights.unmetDemand) {
      lines.push(
        `- ${r.token} on ${nameOf(r.chain)}: ${r.count} request${
          r.count === 1 ? "" : "s"
        }${r.reason ? ` (${r.reason})` : ""}`,
      );
    }
  }

  lines.push("");
  lines.push("Requested but gated behind a paid extension:");
  if (insights.needsExtension.length === 0) {
    lines.push("- none");
  } else {
    for (const r of insights.needsExtension) {
      lines.push(`- ${r.token} on ${nameOf(r.chain)}: ${r.count}`);
    }
  }

  lines.push("");
  lines.push(
    `Top deposit chains: ${insights.topDepositChains
      .map((r) => `${nameOf(r.key)} (${r.count})`)
      .join(", ")}`,
  );
  lines.push(
    `Top deposit tokens: ${insights.topDepositTokens
      .map((r) => `${r.key} (${r.count})`)
      .join(", ")}`,
  );
  lines.push(
    `Top settlement targets: ${insights.topSettlements
      .map((r) => `${r.token} on ${nameOf(r.chain)} (${r.count})`)
      .join(", ")}`,
  );
  lines.push(
    `Extensions most triggered: ${insights.topExtensions
      .map((r) => `${r.key} (${r.count})`)
      .join(", ")}`,
  );

  return lines.join("\n");
}

export async function draftBrief(input: {
  insights: Insights;
  nameOf: (id: string) => string;
}): Promise<string> {
  return getProvider().generate({
    system: SYSTEM,
    user: renderInsights(input.insights, input.nameOf),
    maxTokens: 4096,
  });
}
