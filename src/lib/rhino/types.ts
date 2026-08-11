// Raw response shapes from the rhino.fi public API, observed on 2026-08-11.
// Only the fields the app reads are typed here; the API returns more per object.

export interface RhinoToken {
  token: string;
  address: string;
  decimals: number;
  // Present on some tokens (e.g. USDe, USDS on Arbitrum). Semantics are not
  // documented, so the engine records it but does not yet gate on it. See DESIGN.md.
  maxWithdrawLimit?: number;
}

export interface RhinoChainConfig {
  name: string;
  type: string;
  networkId: string;
  contractAddress: string;
  status: string;
  nativeTokenName: string;
  nativeTokenDecimals: number;
  blockExplorer: string;
  tokens: Record<string, RhinoToken>;
  // Whether a Smart Deposit Address can be minted on this chain.
  enabledDepositAddress: boolean;
  gasBoostEnabled: boolean;
}

export type RhinoBridgeConfigs = Record<string, RhinoChainConfig>;

export interface RhinoSwapToken {
  chain: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  status: { state: string; reason: string[] };
}

export type RhinoSwapTokenConfigs = Record<string, RhinoSwapToken[]>;

export interface RhinoSdaSupportedToken {
  symbol: string;
  address: string;
  minDepositLimitUsd: number;
  maxDepositLimitUsd: number;
}

export interface RhinoSdaSupportedTokens {
  supportedTokens: RhinoSdaSupportedToken[];
}

export interface RhinoQuoteFees {
  fee: string;
  feeUsd: number;
  gasFee: string;
  gasFeeUsd: number;
  platformFee: string;
  platformFeeUsd: number;
  percentageFee: string;
  percentageFeeUsd: number;
}

export interface RhinoQuote {
  chainIn: string;
  chainOut: string;
  payAmount: string;
  payAmountUsd: number;
  receiveAmount: string;
  receiveAmountUsd: number;
  fees: RhinoQuoteFees;
  speed: string;
  token: string;
  _tag: string;
}
