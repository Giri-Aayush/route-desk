// Append-only JSON Lines store on local disk. This is deliberately the simplest
// thing that works for local use and single-node self-hosting. A serverless or
// multi-node deployment should swap the body of these two functions for a durable
// store (Postgres) or a product-analytics pipeline (PostHog); nothing else in the
// app touches the file directly. Server-only: it uses node:fs.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { CheckEvent } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "checks.jsonl");

export async function recordCheck(event: CheckEvent): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(FILE, `${JSON.stringify(event)}\n`, "utf8");
}

export async function readChecks(): Promise<CheckEvent[]> {
  let raw: string;
  try {
    raw = await readFile(FILE, "utf8");
  } catch {
    return []; // no file yet
  }

  const events: CheckEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as CheckEvent);
    } catch {
      // skip a malformed line rather than failing the whole read
    }
  }
  return events;
}
