// POST /api/ai/reply — body { requirement, result, names }. Drafts a client-ready
// reply grounded strictly in the verified check result. names is the id -> display
// name map the client already holds, so the reply reads with real chain names.

import { NextResponse } from "next/server";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { draftReply } from "@/lib/ai/reply";
import type { CheckResult, Requirement } from "@/lib/engine/types";

interface ReplyBody {
  requirement?: Requirement;
  result?: CheckResult;
  names?: Record<string, string>;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const b = (body ?? {}) as ReplyBody;
  if (!b.requirement || !b.result || !Array.isArray(b.result.routes)) {
    return NextResponse.json(
      { error: "requirement and result are required" },
      { status: 400 },
    );
  }

  const names = b.names ?? {};
  const nameOf = (id: string) => names[id] ?? id;

  try {
    const text = await draftReply({
      requirement: b.requirement,
      result: b.result,
      nameOf,
    });
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
    }
    return NextResponse.json(
      { error: "the reply could not be drafted" },
      { status: 502 },
    );
  }
}
