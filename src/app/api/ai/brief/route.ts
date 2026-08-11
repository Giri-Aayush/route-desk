// POST /api/ai/brief — reads the captured checks, aggregates demand, and drafts a
// short BD brief. Same demand data as the /insights page, turned into prose.

import { NextResponse } from "next/server";
import { aggregate } from "@/lib/analytics/aggregate";
import { readChecks } from "@/lib/analytics/store";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { draftBrief } from "@/lib/ai/brief";
import { getBridgeConfigs } from "@/lib/rhino/client";

export async function POST() {
  try {
    const insights = aggregate(await readChecks());
    if (insights.totalChecks === 0) {
      return NextResponse.json({ error: "no_data" }, { status: 400 });
    }

    let names: Record<string, string> = {};
    try {
      const configs = await getBridgeConfigs();
      names = Object.fromEntries(
        Object.entries(configs).map(([id, c]) => [id, c.name]),
      );
    } catch {
      // fall back to raw ids
    }

    const text = await draftBrief({
      insights,
      nameOf: (id: string) => names[id] ?? id,
    });
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    }
    return NextResponse.json(
      { error: "the brief could not be drafted" },
      { status: 502 },
    );
  }
}
