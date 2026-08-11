"use client";

import { ArrowRight, CircleNotch } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckResponse } from "@/lib/api";
import { fetchCatalog, fetchCheck } from "@/lib/api";
import type { Catalog } from "@/lib/engine/catalog";
import type { ArrivalForm, Requirement } from "@/lib/engine/types";
import {
  ChipMultiSelect,
  Field,
  NativeSelect,
  type Option,
  Segmented,
  Switch,
} from "@/components/controls";
import { ContactHandoff } from "@/components/contact-handoff";
import { Results } from "@/components/results";

// The spec's canonical example. Loading with it means a first-time visitor sees a
// full answer immediately instead of an empty form.
const DEFAULT_DEPOSIT_CHAINS = ["ETHEREUM", "MATIC_POS", "TRON", "SOLANA"];
const DEFAULT_DEPOSIT_TOKENS = ["USDT", "USDC"];

const ARRIVAL_OPTIONS: Option[] = [
  { value: "balance", label: "A balance" },
  { value: "vault", label: "A vault position" },
  { value: "contract-call", label: "A contract call" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/60 ${className}`}
    />
  );
}

export function RouteDesk() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [depositChains, setDepositChains] = useState<string[]>(
    DEFAULT_DEPOSIT_CHAINS,
  );
  const [depositTokens, setDepositTokens] = useState<string[]>(
    DEFAULT_DEPOSIT_TOKENS,
  );
  const [settlementChain, setSettlementChain] = useState("BASE");
  const [settlementToken, setSettlementToken] = useState("USDC");
  const [arrivalForm, setArrivalForm] = useState<ArrivalForm>("balance");
  const [amountUsd, setAmountUsd] = useState("1000");
  const [guaranteedRate, setGuaranteedRate] = useState(false);
  const [clientSurcharge, setClientSurcharge] = useState(false);
  const [enhancedScreening, setEnhancedScreening] = useState(false);

  const [result, setResult] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const autoRan = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then(setCatalog)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setCatalogError(e instanceof Error ? e.message : "unavailable");
        }
      });
    return () => controller.abort();
  }, []);

  const chainName = useCallback(
    (id: string) => catalog?.chains[id]?.name ?? id,
    [catalog],
  );

  const canCheck =
    depositChains.length > 0 &&
    depositTokens.length > 0 &&
    settlementChain !== "" &&
    settlementToken !== "";

  const runCheck = useCallback(async () => {
    if (!canCheck) return;
    setChecking(true);
    setCheckError(null);
    const requirement: Requirement & { amountUsd?: number } = {
      depositChains,
      depositTokens,
      settlementChain,
      settlementToken,
      arrivalForm,
      commercial: { guaranteedRate, clientSurcharge, enhancedScreening },
      amountUsd: Number(amountUsd) > 0 ? Number(amountUsd) : undefined,
    };
    try {
      setResult(await fetchCheck(requirement));
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "The check failed.");
      setResult(null);
    } finally {
      setChecking(false);
    }
  }, [
    canCheck,
    depositChains,
    depositTokens,
    settlementChain,
    settlementToken,
    arrivalForm,
    amountUsd,
    guaranteedRate,
    clientSurcharge,
    enhancedScreening,
  ]);

  // Run the default example once, as soon as the catalog is ready.
  useEffect(() => {
    if (catalog && !autoRan.current) {
      autoRan.current = true;
      void runCheck();
    }
  }, [catalog, runCheck]);

  const chainOptions: Option[] = catalog
    ? Object.values(catalog.chains)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name }))
    : [];

  const tokenOptions: Option[] = catalog ? depositTokenOptions(catalog) : [];

  const settlementTokenOptions: Option[] =
    catalog && catalog.chains[settlementChain]
      ? Object.keys(catalog.chains[settlementChain].tokens)
          .sort()
          .map((s) => ({ value: s, label: s }))
      : [];

  function onSettlementChainChange(id: string) {
    setSettlementChain(id);
    const tokens = catalog?.chains[id]?.tokens ?? {};
    if (!tokens[settlementToken]) {
      setSettlementToken(Object.keys(tokens)[0] ?? "");
    }
  }

  const requirement: Requirement & { amountUsd?: number } = {
    depositChains,
    depositTokens,
    settlementChain,
    settlementToken,
    arrivalForm,
    commercial: { guaranteedRate, clientSurcharge, enhancedScreening },
    amountUsd: Number(amountUsd) > 0 ? Number(amountUsd) : undefined,
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Route Desk
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Describe what you need to move. Route Desk checks each deposit chain
            and token against rhino.fi&apos;s live API and tells you what is
            clear, what needs a paid extension, and what cannot be done.
          </p>
        </div>
        <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Unofficial
        </span>
      </header>

      {catalogError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm dark:border-rose-500/25 dark:bg-rose-500/10">
          <p className="font-semibold text-rose-800 dark:text-rose-300">
            The check is unavailable
          </p>
          <p className="mt-1 text-rose-700/90 dark:text-rose-300/80">
            {catalogError} The tool does not guess when it cannot reach the live
            data. Please try again shortly.
          </p>
        </div>
      ) : null}

      {!catalog && !catalogError ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      ) : null}

      {catalog ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runCheck();
          }}
          className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Deposit chains" hint="Where funds come from.">
              <ChipMultiSelect
                options={chainOptions}
                selected={depositChains}
                onToggle={(v) => setDepositChains((c) => toggle(c, v))}
              />
            </Field>
            <Field label="Deposit tokens" hint="What funds arrive as.">
              <ChipMultiSelect
                options={tokenOptions}
                selected={depositTokens}
                onToggle={(v) => setDepositTokens((t) => toggle(t, v))}
              />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Field label="Settlement chain" htmlFor="settlement-chain">
              <NativeSelect
                id="settlement-chain"
                value={settlementChain}
                onChange={onSettlementChainChange}
                options={chainOptions}
              />
            </Field>
            <Field label="Settlement token" htmlFor="settlement-token">
              <NativeSelect
                id="settlement-token"
                value={settlementToken}
                onChange={setSettlementToken}
                options={settlementTokenOptions}
              />
            </Field>
            <Field label="Amount (USD)" htmlFor="amount" hint="Used for limits and cost.">
              <div className="flex items-center rounded-lg border border-zinc-200 bg-white pl-3 focus-within:ring-2 focus-within:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-sm text-zinc-400">$</span>
                <input
                  id="amount"
                  inputMode="decimal"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="w-full bg-transparent px-2 py-2.5 text-sm text-zinc-900 focus:outline-none dark:text-zinc-100"
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Funds should arrive as"
              hint="Anything other than a balance needs Automated Onchain Actions."
            >
              <Segmented
                value={arrivalForm}
                onChange={(v) => setArrivalForm(v as ArrivalForm)}
                options={ARRIVAL_OPTIONS}
              />
            </Field>
            <Field label="Commercial requirements">
              <div className="flex flex-col gap-3">
                <Switch
                  checked={guaranteedRate}
                  onChange={setGuaranteedRate}
                  label="Guaranteed conversion rate"
                  description="Forces 1:1 Stablecoin Swaps."
                />
                <Switch
                  checked={clientSurcharge}
                  onChange={setClientSurcharge}
                  label="Surcharge on top of rhino fees"
                  description="Forces Advanced Fee & Limit Management."
                />
                <Switch
                  checked={enhancedScreening}
                  onChange={setEnhancedScreening}
                  label="Screening beyond the standard set"
                  description="Forces Enhanced Compliance & Risk Management."
                />
              </div>
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canCheck || checking}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.99] disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {checking ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" />
              ) : (
                <ArrowRight size={16} weight="bold" />
              )}
              {checking ? "Checking" : "Check routes"}
            </button>
            {!canCheck ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Pick at least one deposit chain and token, and a settlement.
              </span>
            ) : null}
          </div>
        </form>
      ) : null}

      {checkError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm dark:border-rose-500/25 dark:bg-rose-500/10">
          <p className="font-semibold text-rose-800 dark:text-rose-300">
            The check could not run
          </p>
          <p className="mt-1 text-rose-700/90 dark:text-rose-300/80">
            {checkError}
          </p>
        </div>
      ) : null}

      {checking && !result ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-48" />
        </div>
      ) : null}

      {result ? (
        <>
          <Results
            key={result.fetchedAt}
            result={result}
            chainName={chainName}
            settlementChain={settlementChain}
            settlementToken={settlementToken}
            amount={Number(amountUsd) > 0 ? amountUsd : "1000"}
          />
          <ContactHandoff
            requirement={requirement}
            result={result}
            chainName={chainName}
          />
        </>
      ) : null}

      <footer className="mt-auto border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p>
          Route and token data belongs to rhino.fi. This tool is unofficial and
          not affiliated with, endorsed by, or operated by rhino.fi.
        </p>
        {result ? (
          <p className="mt-1 text-zinc-400 dark:text-zinc-500">
            Support checked against live rhino.fi data.
          </p>
        ) : null}
      </footer>
    </div>
  );
}

function depositTokenOptions(catalog: Catalog): Option[] {
  const counts = new Map<string, number>();
  for (const chain of Object.values(catalog.chains)) {
    for (const symbol of Object.keys(chain.tokens)) {
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([symbol]) => ({ value: symbol, label: symbol }));
}
