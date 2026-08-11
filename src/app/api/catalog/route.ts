// GET /api/catalog
// Normalized chains and tokens for the form. Served from the cached /bridge/configs
// fetch. If rhino.fi is unavailable, this returns 502 rather than a guess, so the
// client can say the check is unavailable.

import { NextResponse } from "next/server";
import { buildCatalog } from "@/lib/engine/catalog";
import { getBridgeConfigs, RhinoApiError } from "@/lib/rhino/client";

export async function GET() {
  try {
    const configs = await getBridgeConfigs();
    const catalog = buildCatalog(configs, new Date().toISOString());
    return NextResponse.json(catalog);
  } catch (err) {
    if (err instanceof RhinoApiError) {
      return NextResponse.json(
        { error: "rhino.fi config is unavailable" },
        { status: 502 },
      );
    }
    throw err;
  }
}
