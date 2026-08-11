// GET /api/ai/status — whether the AI workspace is configured (ANTHROPIC_API_KEY set).
// The workspace reads this on load to show its ready or unconfigured state.

import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ configured: isAiConfigured() });
}
