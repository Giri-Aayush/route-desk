// GET /api/quote?chainIn&chainOut&tokenIn&tokenOut&amount&mode[&isSda]
// A single live quote for one clear route. A 4xx from rhino.fi means the route is
// not quotable (a real "no", returned as available:false), a 5xx means the quote
// service is down (502). Each answer carries the time it was fetched.

import { NextResponse, type NextRequest } from "next/server";
import { getQuote, RhinoApiError, type QuoteParams } from "@/lib/rhino/client";

const REQUIRED = [
  "chainIn",
  "chainOut",
  "tokenIn",
  "tokenOut",
  "amount",
  "mode",
] as const;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const missing = REQUIRED.filter((k) => !sp.get(k));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `missing params: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const mode = sp.get("mode");
  if (mode !== "pay" && mode !== "receive") {
    return NextResponse.json(
      { error: "mode must be pay or receive" },
      { status: 400 },
    );
  }

  const params: QuoteParams = {
    chainIn: sp.get("chainIn")!,
    chainOut: sp.get("chainOut")!,
    tokenIn: sp.get("tokenIn")!,
    tokenOut: sp.get("tokenOut")!,
    amount: sp.get("amount")!,
    mode,
    isSda: sp.get("isSda") === "true",
  };

  try {
    const quote = await getQuote(params);
    return NextResponse.json({
      available: true,
      quote,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof RhinoApiError) {
      if (err.status >= 400 && err.status < 500) {
        const reason = err.body.slice(0, 200) || "route not available";
        return NextResponse.json({ available: false, reason }, { status: 200 });
      }
      return NextResponse.json(
        { error: "quote service unavailable" },
        { status: 502 },
      );
    }
    throw err;
  }
}
