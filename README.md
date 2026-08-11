# Route Desk

A public route checker for [rhino.fi](https://rhino.fi). Describe what you need to
move, the deposit chains and tokens, where it settles, and what it should become,
and get a straight answer: which routes are clear, which need a paid extension, and
which cannot be done, with the reason for each. Every answer is computed from
rhino.fi's live API rather than a table maintained by hand.

> **Unofficial.** Chain and token data belongs to rhino.fi. This project is not
> affiliated with, endorsed by, or operated by rhino.fi. Any public deployment must
> keep this notice.

## The problem

A client requirement is rarely one route. "We take USDT and USDC from Ethereum,
Polygon, Tron and Solana, and settle in USDC on Base" is eight deposit routes plus a
settlement leg. Answering it today means cross-checking three tables on the Supported
Chains page that do not fully agree, once per route. So the answer becomes "let me
confirm and come back to you," and a qualified prospect waits a day for a lookup.

## What it does

One page, no login, no wallet. You give it:

- deposit chains and deposit tokens
- a settlement chain and settlement token
- what the funds should become on arrival
- three yes-or-no commercial questions

It expands the request into individual routes (one cell per deposit chain and token),
checks each one, and returns:

- a verdict line: how many routes are clear, how many need an extension, how many
  cannot be done
- a grid of deposit chains against tokens, each cell carrying its outcome and, where
  it fails, the reason
- the extensions the request forces, each tied to the specific requirement that
  triggered it
- a live cost per clear route, labelled with the time it was fetched

## How it works

Three support tables, kept separate because rhino.fi models them separately:

| Table | Question it answers | Source |
| --- | --- | --- |
| Bridge | Which chains a token can move between | `GET /bridge/configs` |
| Bridge and swap | Which tokens a chain can send and receive | `GET /bridge/configs`, `GET /bridge/bridge-swap-token-configs` |
| Smart Deposit Address | Which tokens a deposit address can receive, with min and max | `GET /sda/deposit-addresses/{depositChain}/{destinationChain}/supported-tokens` |

Cost comes from `GET /bridge/quote/bridge-swap/public`, which returns a real quote
with exact fees. All four endpoints are public and need no key.

The config and quotes are fetched server-side and cached, so the browser never calls
rhino.fi directly and repeated lookups do not multiply upstream load.

## Accuracy

This is public, so a wrong yes is a commercial problem, not a bug. The rules:

- Never invent a yes. If the config fetch fails, the tool says the check is
  unavailable and offers the contact form. It does not fall back to a cached guess
  presented as current.
- Every value that is not fetched live is labelled as pinned, with a date.
- Quotes show the time they were fetched, because fees expire.
- The tool states what is supported. It never states a date, a timeline, or a
  commitment. Those are commercial answers and belong to a person.
- A blocked route says what blocks it and offers the contact form.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4. Route handlers proxy and
cache the rhino.fi API. No database.

## Local development

```bash
npm install
npm run dev
```

The app reads the rhino.fi API base from `RHINO_API_BASE` and falls back to
`https://api.rhino.fi`. See `.env.example`.

## Status

Early. The data layer and route engine come first, the interface second. See
[docs/DESIGN.md](docs/DESIGN.md) for the verified architecture, the endpoint
findings, and the open items.
