// The catalog is the app's normalized view of rhino.fi's chain and token config:
// display names, chain family, whether a chain can mint a Smart Deposit Address,
// and the tokens each chain lists. Built once from /bridge/configs and handed to
// the pure check logic.

import type { RhinoBridgeConfigs } from "../rhino/types";

export interface CatalogToken {
  symbol: string;
  address: string;
  decimals: number;
  maxWithdrawLimit?: number;
}

export interface CatalogChain {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  canMintSda: boolean;
  tokens: Record<string, CatalogToken>;
}

export interface Catalog {
  chains: Record<string, CatalogChain>;
  fetchedAt: string;
}

export function buildCatalog(
  configs: RhinoBridgeConfigs,
  fetchedAt: string,
): Catalog {
  const chains: Record<string, CatalogChain> = {};

  for (const [id, config] of Object.entries(configs)) {
    const tokens: Record<string, CatalogToken> = {};
    for (const [symbol, token] of Object.entries(config.tokens ?? {})) {
      tokens[symbol] = {
        symbol,
        address: token.address,
        decimals: token.decimals,
        maxWithdrawLimit: token.maxWithdrawLimit,
      };
    }

    chains[id] = {
      id,
      name: config.name,
      type: config.type,
      enabled: config.status === "enabled",
      canMintSda: Boolean(config.enabledDepositAddress),
      tokens,
    };
  }

  return { chains, fetchedAt };
}

export function chainSupportsToken(
  catalog: Catalog,
  chainId: string,
  symbol: string,
): boolean {
  return Boolean(catalog.chains[chainId]?.tokens[symbol]);
}
