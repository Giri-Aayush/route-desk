import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import type { CheckEvent } from "./types";

function event(overrides: Partial<CheckEvent>): CheckEvent {
  return {
    at: "2026-08-11T00:00:00.000Z",
    settlementChain: "BASE",
    settlementToken: "USDC",
    routes: [],
    extensions: [],
    ...overrides,
  };
}

describe("aggregate", () => {
  it("returns empty insights for no events", () => {
    const r = aggregate([]);
    expect(r.totalChecks).toBe(0);
    expect(r.totalRoutes).toBe(0);
    expect(r.clearRate).toBe(0);
    expect(r.since).toBeNull();
    expect(r.unmetDemand).toEqual([]);
  });

  it("counts checks, routes, and clear rate", () => {
    const r = aggregate([
      event({
        routes: [
          { chain: "ETHEREUM", token: "USDC", outcome: "clear" },
          {
            chain: "TRON",
            token: "USDC",
            outcome: "blocked",
            reason: "not supported",
          },
        ],
      }),
    ]);
    expect(r.totalChecks).toBe(1);
    expect(r.totalRoutes).toBe(2);
    expect(r.clearRate).toBe(0.5);
  });

  it("ranks unmet demand by frequency and keeps the reason", () => {
    const tron = Array.from({ length: 3 }, () =>
      event({
        routes: [
          {
            chain: "TRON",
            token: "USDC",
            outcome: "blocked",
            reason: "USDC not on Tron",
          },
        ],
      }),
    );
    const solana = event({
      routes: [
        {
          chain: "SOLANA",
          token: "EURC",
          outcome: "blocked",
          reason: "no EURC on Solana",
        },
      ],
    });
    const r = aggregate([...tron, solana]);
    expect(r.unmetDemand[0]).toEqual({
      chain: "TRON",
      token: "USDC",
      count: 3,
      reason: "USDC not on Tron",
    });
    expect(r.unmetDemand[1]).toMatchObject({
      chain: "SOLANA",
      token: "EURC",
      count: 1,
    });
  });

  it("separates extension demand from blocked demand", () => {
    const r = aggregate([
      event({
        routes: [
          {
            chain: "TRON",
            token: "USDT",
            outcome: "extension",
            reason: "Tron Access",
          },
        ],
      }),
    ]);
    expect(r.needsExtension[0]).toMatchObject({
      chain: "TRON",
      token: "USDT",
      count: 1,
    });
    expect(r.unmetDemand).toEqual([]);
  });

  it("counts a chain and token once per check, not once per route", () => {
    const r = aggregate([
      event({
        routes: [
          { chain: "ETHEREUM", token: "USDC", outcome: "clear" },
          { chain: "ETHEREUM", token: "USDT", outcome: "clear" },
        ],
      }),
    ]);
    expect(r.topDepositChains.find((c) => c.key === "ETHEREUM")?.count).toBe(1);
    expect(r.topDepositTokens.find((t) => t.key === "USDC")?.count).toBe(1);
    expect(r.topDepositTokens.find((t) => t.key === "USDT")?.count).toBe(1);
  });

  it("tracks settlements and extensions, and the earliest timestamp", () => {
    const r = aggregate([
      event({
        at: "2026-08-11T09:00:00.000Z",
        extensions: ["Tron Access"],
        routes: [{ chain: "TRON", token: "USDT", outcome: "extension" }],
      }),
      event({ at: "2026-08-11T08:00:00.000Z", extensions: ["Tron Access"] }),
    ]);
    expect(r.since).toBe("2026-08-11T08:00:00.000Z");
    expect(r.topSettlements[0]).toMatchObject({
      token: "USDC",
      chain: "BASE",
      count: 2,
    });
    expect(r.topExtensions[0]).toEqual({ key: "Tron Access", count: 2 });
  });
});
