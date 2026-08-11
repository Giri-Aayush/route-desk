# Route Desk design

This records what the tool is, how it decides, and what was verified against the live
rhino.fi API on 2026-08-11. It replaces the guesses in the original brief with
confirmed facts. Where the brief and the live API disagree, the API wins and the
correction is noted.

## Data sources

All four endpoints are public: no key, no JWT. Verified live on 2026-08-11.

### 1. Chain and token config

`GET https://api.rhino.fi/bridge/configs`

Returns an object keyed by chain id. rhino.fi's own architecture page calls this the
source of truth for the bridging flow.

Chain ids are not display names. `MATIC_POS` is Polygon, `BINANCE` is BNB Smart
Chain, `OPBNB` is opBNB. The display name is on each entry, so the id-to-name map is
built from the config itself rather than hardcoded. Each entry carries:

- `name`: display name, for example "Arbitrum One"
- `type`: chain family, for example `EVM`
- `status`: `enabled` or otherwise
- `enabledDepositAddress`: whether a Smart Deposit Address can be minted on this
  chain. This is the flag the brief said no table exposes. It is here.
- `tokens`: a map from canonical symbol to `{ address, decimals, maxWithdrawLimit? }`.
  `maxWithdrawLimit: 0` marks a token that cannot be a withdrawal (destination) asset,
  for example USDe and USDS on Arbitrum.
- routing metadata: `networkId`, `contractAddress`, `confirmationBlocks`,
  `avgBlockTime`, `nativeTokenName`, `rpc`, `blockExplorer`

Token symbols in the config are canonical (`USDT`, `USDC`, `ETH`). The chain-specific
representation the docs show (USDT0 on Arbitrum, USDT.e on Base, USDT.b on BNB) is
display sugar and is not in this response. The quote and SDA endpoints also speak
canonical symbols. Representation labels therefore come from the Supported Chains doc
and are treated as a pinned lookup (see Open items).

### 2. Swap token config

`GET https://api.rhino.fi/bridge/bridge-swap-token-configs`

Per-chain swap token detail. Lists more chains than `/bridge/configs` (adds
BERACHAIN, EVEDEX, GRVT). Used for the send and receive sides of the bridge-and-swap
table.

### 3. SDA supported tokens, with limits

`GET https://api.rhino.fi/sda/deposit-addresses/{depositChain}/{destinationChain}/supported-tokens`

The one open door in the SDA namespace: every other `/sda` endpoint requires a bearer
token or API key, this one has empty security. It is keyed by the pair, not a single
global list, so the answer to "what can a deposit address on X receive" depends on
where it settles.

Returns, per token: `symbol`, `address`, `minDepositLimitUsd`, `maxDepositLimitUsd`.
Ethereum to Base returns min 5 USD, max 10,000,000 USD across USDC, USDT, USDe, USDS,
EURC, WBTC and ETH.

This closes the limits question the brief left open. The 5 USD floor is live and
machine-readable, so a route that is technically supported but sits under the minimum
is caught rather than shown as a false yes.

### 4. Quote

`GET https://api.rhino.fi/bridge/quote/bridge-swap/public`

Required query params: `chainIn`, `chainOut`, `tokenIn`, `tokenOut`, `amount`, `mode`
(`pay` or `receive`). Optional: `isSda` (true for a deposit-address route),
`amountNative` (gas boost). Returns `payAmount`, `receiveAmount`, both USD
equivalents, and a `fees` breakdown (percentage fee, gas fee, platform fee).
Ethereum to Base, 1000 USDC, mode pay: 0.7 percent plus gas, fee 0.72 USD, receive
999.28 USDC.

## Path corrections from the brief

The brief specified these three endpoints, and two of them 404 as written. The
corrections:

- SDA supported tokens is `/sda/deposit-addresses/{depositChain}/{destinationChain}/supported-tokens`,
  not a flat `/sda/deposit-addresses/supported-tokens`. The flat path 404s. The 404 is
  a wrong path, not an auth wall.
- The quote is a `GET` with query params, not a `POST` with a body. A POST returns 404.
- The `/bridge/depositaddresses/*` paths are a deprecated backwards-compatible alias.
  Use the `/sda` namespace.

## The model

Three tables, kept separate. Collapsing them into one support flag is the mistake that
makes a checker wrong: a chain can be a valid settlement destination and still be
unable to mint a deposit address.

### Route expansion

Deposit chains and deposit tokens produce one route per pair. Four chains and two
tokens is eight routes, each evaluated on its own.

### Per-route outcome

One of:

- clear
- needs an extension, with the extension named
- cannot be done, with the reason in plain words, for example "USDC is not supported
  on Tron"

### Settlement leg

Checked once, separately. If the settlement token is not supported on the settlement
chain, nothing else matters and the tool says so first.

### Extension derivation

Derived from the whole request, not per route:

| Trigger in the request | Extension forced |
| --- | --- |
| Tron among the deposit chains | Tron Access |
| A deposit chain that cannot mint an SDA (`enabledDepositAddress` false, or absent from the SDA pair response) | Custom Chain & Token Support |
| A guaranteed conversion rate | 1:1 Stablecoin Swaps |
| Funds should land as anything other than a balance | Automated Onchain Actions |
| A client surcharge on top of rhino fees | Advanced Fee & Limit Management |
| Screening beyond the standard set | Enhanced Compliance & Risk Management |

### Cost

A live quote per clear route at a representative amount, labelled with fetch time.

## Serving and rate limits

The public endpoints are fetched server-side through route handlers and cached with
Next.js time-based revalidation:

- config and swap token config: long revalidation, they change rarely
- SDA supported tokens per pair: medium revalidation
- quotes: short revalidation, keyed by the full parameter set, since fees move

The browser only ever calls this app's own routes. One upstream fetch per revalidation
window serves every visitor, which keeps a public tool from multiplying load on
rhino.fi. Quote requests are debounced on the client.

## Observed drift

A tool that reads the live config surfaces disagreements with the docs. As of
2026-08-11:

- `/bridge/configs` lists BITCOIN, ARC and PRIVILY. None appear in the Supported
  Chains tables.
- `/bridge/bridge-swap-token-configs` adds BERACHAIN, EVEDEX and GRVT. None appear in
  the tables.
- The Supported Chains page teaches the bridging rule with a worked example on Sonic
  and Paradex. Neither is in any of the three tables on that page.

These are recorded, not resolved. They are an argument for reading the config rather
than a table.

## Open items

- Representation labels (USDT0, USDT.e, USDT.b) are not in the API. They come from the
  Supported Chains doc and are treated as a pinned lookup, labelled as such in the
  interface. rhino publishes docs as raw markdown at a `.md` suffix, so a job can diff
  that page to keep the lookup current.
- The public quote response carries no expiry field. The tool labels each quote with
  the time it was fetched.
- Public endpoint rate limits are not documented. The server-side cache and client
  debounce are the mitigation. Real limits need confirming before a real launch.
- The contact form's submission target is not built. rhino's lead endpoint is not
  known, so v0.1 produces a pre-filled, structured payload and hands off. Wiring a
  real destination is out of scope until that endpoint is known.

## Not in scope

Not a quote-and-execute flow. Not a wallet or a key. Not integration timelines or
pricing. Not a replacement for the Supported Chains page, which stays the reference.
This answers one question: can this specific requirement be served, at what cost, and
what does it need.
