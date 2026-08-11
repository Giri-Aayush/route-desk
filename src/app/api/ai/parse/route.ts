// POST /api/ai/parse — body { message }. Turns a prospect's plain-English message
// into a structured requirement using Claude, validated against the live catalog.
// The model only extracts; feasibility is decided by /api/check on the result.

import { NextResponse } from "next/server";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { parseIntake } from "@/lib/ai/intake";
import { buildCatalog } from "@/lib/engine/catalog";
import { getBridgeConfigs, RhinoApiError } from "@/lib/rhino/client";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const message = (body as { message?: unknown })?.message;
  if (typeof message !== "string" || message.trim().length < 3) {
    return NextResponse.json({ error: "a message is required" }, { status: 400 });
  }

  try {
    const catalog = buildCatalog(await getBridgeConfigs(), new Date().toISOString());
    return NextResponse.json(await parseIntake(message, catalog));
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    }
    if (err instanceof RhinoApiError) {
      return NextResponse.json({ error: "rhino.fi is unavailable" }, { status: 502 });
    }
    return NextResponse.json(
      { error: "the message could not be parsed" },
      { status: 502 },
    );
  }
}
