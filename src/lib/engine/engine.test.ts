import { describe, expect, it } from "vitest";
import type {
  RhinoBridgeConfigs,
  RhinoSdaSupportedToken,
} from "../rhino/types";
import { buildCatalog } from "./catalog";
import { checkSettlement, runCheck, type SdaByDepositChain } from "./check";
import { deriveExtensions } from "./extensions";
import type { Requirement } from "./types";

function chain(
  name: string,
  type: string,
  canMintSda: boolean,
  tokens: string[],
): RhinoBridgeConfigs[string] {
  return {
    name,
    type,
    networkId: "0",
    contractAddress: "0x",
    status: "enabled",
    nativeTokenName: "ETH",
    nativeTokenDecimals: 18,
    blockExplorer: "",
    enabledDepositAddress: canMintSda,
    gasBoostEnabled: false,
    tokens: Object.fromEntries(
      tokens.map((t) => [t, { token: t, address: "0x", decimals: 6 }]),
    ),
  };
}

const configs: RhinoBridgeConfigs = {
  ETHEREUM: chain("Ethereum", "EVM", true, ["USDC", "USDT", "ETH"]),
  BASE: chain("Base", "EVM", true, ["USDC", "ETH"]),
  TRON: chain("Tron", "TRON", true, ["USDT"]),
  STARKNET: chain("Starknet", "STARKNET", false, ["USDC"]),
};

const catalog = buildCatalog(configs, "2026-08-11T00:00:00.000Z");

function sda(
  symbols: string[],
  min = 5,
  max = 10_000_000,
): RhinoSdaSupportedToken[] {
  return symbols.map((symbol) => ({
    symbol,
    address: "0x",
    minDepositLimitUsd: min,
    maxDepositLimitUsd: max,
  }));
}

const baseReq: Requirement = {
  depositChains: ["ETHEREUM"],
  depositTokens: ["USDC"],
  settlementChain: "BASE",
  settlementToken: "USDC",
  arrivalForm: "balance",
  commercial: {
    guaranteedRate: false,
    clientSurcharge: false,
    enhancedScreening: false,
  },
};

function check(req: Requirement, sdaMap: SdaByDepositChain, amountUsd = 1000) {
  return runCheck({
    requirement: req,
    catalog,
    sdaByDepositChain: sdaMap,
    representativeAmountUsd: amountUsd,
  });
}

describe("buildCatalog", () => {
  it("maps chain id to display name, SDA capability, and tokens", () => {
    expect(catalog.chains.ETHEREUM.name).toBe("Ethereum");
    expect(catalog.chains.ETHEREUM.canMintSda).toBe(true);
    expect(catalog.chains.STARKNET.canMintSda).toBe(false);
    expect(Object.keys(catalog.chains.ETHEREUM.tokens)).toContain("USDC");
  });
});

describe("checkSettlement", () => {
  it("accepts a supported chain and token", () => {
    expect(checkSettlement(baseReq, catalog).ok).toBe(true);
  });

  it("rejects an unknown settlement chain", () => {
    expect(
      checkSettlement({ ...baseReq, settlementChain: "NOWHERE" }, catalog).ok,
    ).toBe(false);
  });

  it("rejects ETH as a settlement asset", () => {
    const v = checkSettlement({ ...baseReq, settlementToken: "ETH" }, catalog);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("ETH");
  });

  it("rejects a token not supported on the settlement chain", () => {
    // Base has no USDT in the fixture.
    expect(
      checkSettlement({ ...baseReq, settlementToken: "USDT" }, catalog).ok,
    ).toBe(false);
  });
});

describe("runCheck route outcomes", () => {
  it("marks a supported, in-limit, non-Tron route as clear", () => {
    const res = check(baseReq, { ETHEREUM: sda(["USDC", "USDT"]) });
    expect(res.routes).toHaveLength(1);
    expect(res.routes[0]).toMatchObject({
      depositChain: "ETHEREUM",
      depositToken: "USDC",
      outcome: "clear",
      limits: { minUsd: 5, maxUsd: 10_000_000 },
    });
    expect(res.summary).toEqual({ clear: 1, extension: 0, blocked: 0 });
  });

  it("blocks a deposit below the minimum", () => {
    const res = check(baseReq, { ETHEREUM: sda(["USDC"], 5) }, 3);
    expect(res.routes[0].outcome).toBe("blocked");
    expect(res.routes[0].reason).toContain("minimum");
  });

  it("blocks a deposit above the maximum", () => {
    const res = check(baseReq, { ETHEREUM: sda(["USDC"], 5, 100) }, 1000);
    expect(res.routes[0].outcome).toBe("blocked");
    expect(res.routes[0].reason).toContain("maximum");
  });

  it("blocks a token the SDA cannot receive", () => {
    const res = check(
      { ...baseReq, depositTokens: ["USDT"] },
      { ETHEREUM: sda(["USDC"]) },
    );
    expect(res.routes[0].outcome).toBe("blocked");
    expect(res.routes[0].reason).toContain("USDT");
  });

  it("routes a chain that cannot mint an SDA to Custom Chain & Token Support", () => {
    const res = check(
      { ...baseReq, depositChains: ["STARKNET"] },
      { STARKNET: null },
    );
    expect(res.routes[0]).toMatchObject({
      outcome: "extension",
      extension: "custom-chain-token",
    });
  });

  it("routes a Tron deposit to Tron Access", () => {
    const res = check(
      { ...baseReq, depositChains: ["TRON"], depositTokens: ["USDT"] },
      { TRON: sda(["USDT"]) },
    );
    expect(res.routes[0]).toMatchObject({
      outcome: "extension",
      extension: "tron-access",
    });
  });

  it("blocks every route and leads with settlement when the leg is broken", () => {
    const res = check(
      { ...baseReq, settlementToken: "ETH" },
      { ETHEREUM: sda(["USDC"]) },
    );
    expect(res.settlement.ok).toBe(false);
    expect(res.routes.every((r) => r.outcome === "blocked")).toBe(true);
  });

  it("expands to one route per deposit chain and token", () => {
    const res = check(
      { ...baseReq, depositChains: ["ETHEREUM", "BASE"], depositTokens: ["USDC", "USDT"] },
      { ETHEREUM: sda(["USDC", "USDT"]), BASE: sda(["USDC"]) },
    );
    expect(res.routes).toHaveLength(4);
  });
});

describe("deriveExtensions", () => {
  const ids = (req: Requirement) => deriveExtensions(req, catalog).map((e) => e.id);

  it("returns nothing for a plain balance request with no commercial flags", () => {
    expect(ids(baseReq)).toEqual([]);
  });

  it("forces Tron Access when Tron is a deposit chain", () => {
    expect(ids({ ...baseReq, depositChains: ["TRON"] })).toContain("tron-access");
  });

  it("forces Custom Chain & Token Support for a non-SDA deposit chain", () => {
    expect(ids({ ...baseReq, depositChains: ["STARKNET"] })).toContain(
      "custom-chain-token",
    );
  });

  it("forces 1:1 Stablecoin Swaps for a guaranteed rate", () => {
    expect(
      ids({ ...baseReq, commercial: { ...baseReq.commercial, guaranteedRate: true } }),
    ).toContain("stablecoin-swaps");
  });

  it("forces Automated Onchain Actions when funds should not arrive as a balance", () => {
    expect(ids({ ...baseReq, arrivalForm: "vault" })).toContain("onchain-actions");
  });

  it("forces Advanced Fee & Limit Management for a client surcharge", () => {
    expect(
      ids({ ...baseReq, commercial: { ...baseReq.commercial, clientSurcharge: true } }),
    ).toContain("fee-limit-management");
  });

  it("forces Enhanced Compliance for screening beyond the standard set", () => {
    expect(
      ids({ ...baseReq, commercial: { ...baseReq.commercial, enhancedScreening: true } }),
    ).toContain("compliance");
  });
});
