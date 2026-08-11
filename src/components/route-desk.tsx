"use client";

import { ArrowRight, ChartLineUp, CircleNotch } from "@phosphor-icons/react";
import Link from "next/link";
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
  { value: "balance", label: "Balance" },
  { value: "vault", label: "Vault" },
  { value: "contract-call", label: "Contract" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-border/60 ${className}`} />
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
    <div className="relative flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(233,108,25,0.10),transparent_75%)]"
      />

      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className="h-6 w-6 rounded-lg bg-gradient-to-br from-brand to-brand-strong shadow-sm"
            aria-hidden
          />
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
            Route Desk
          </h1>
          <span className="hidden text-sm text-muted sm:inline">
            Live rhino.fi route checker
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
          >
            <ChartLineUp size={15} weight="bold" />
            Insights
          </Link>
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            Unofficial
          </span>
        </div>
      </header>

      <main className="flex-1 lg:min-h-0">
        <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 lg:grid-cols-[minmax(400px,460px)_1fr]">
          <section className="border-b border-border p-5 lg:h-full lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {catalog ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runCheck();
                }}
                className="flex flex-col gap-4"
              >
                <Field label="Deposit chains" hint="Where funds come from.">
                  <ChipMultiSelect
                    options={chainOptions}
                    selected={depositChains}
                    onToggle={(v) => setDepositChains((c) => toggle(c, v))}
                    maxHeightClass="max-h-40"
                  />
                </Field>
                <Field label="Deposit tokens" hint="What funds arrive as.">
                  <ChipMultiSelect
                    options={tokenOptions}
                    selected={depositTokens}
                    onToggle={(v) => setDepositTokens((t) => toggle(t, v))}
                    maxHeightClass="max-h-24"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-[1fr_1.5fr] gap-4">
                  <Field label="Amount (USD)" htmlFor="amount" hint="Limits and cost.">
                    <div className="flex items-center rounded-xl border border-border bg-surface pl-3 focus-within:ring-2 focus-within:ring-brand/50">
                      <span className="text-sm text-muted">$</span>
                      <input
                        id="amount"
                        inputMode="decimal"
                        value={amountUsd}
                        onChange={(e) => setAmountUsd(e.target.value)}
                        className="w-full bg-transparent px-2 py-2.5 text-sm text-foreground focus:outline-none"
                      />
                    </div>
                  </Field>
                  <Field label="Funds arrive as" hint="Non-balance needs Onchain Actions.">
                    <Segmented
                      value={arrivalForm}
                      onChange={(v) => setArrivalForm(v as ArrivalForm)}
                      options={ARRIVAL_OPTIONS}
                    />
                  </Field>
                </div>

                <Field label="Commercial requirements">
                  <div className="flex flex-col gap-2">
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

                <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 border-t border-border bg-background/90 px-5 py-3 backdrop-blur">
                  <button
                    type="submit"
                    disabled={!canCheck || checking}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-[0.99] disabled:opacity-40"
                  >
                    {checking ? (
                      <CircleNotch
                        size={16}
                        weight="bold"
                        className="animate-spin"
                      />
                    ) : (
                      <ArrowRight size={16} weight="bold" />
                    )}
                    {checking ? "Checking" : "Check routes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-28" />
                <Skeleton className="h-24" />
                <Skeleton className="h-28" />
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4 p-5 lg:h-full lg:overflow-y-auto">
            {catalogError ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm">
                <p className="font-semibold text-red-700 dark:text-red-400">
                  The check is unavailable
                </p>
                <p className="mt-1 text-red-700/90 dark:text-red-300/80">
                  {catalogError} The tool does not guess when it cannot reach the
                  live data. Please try again shortly.
                </p>
              </div>
            ) : checkError ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm">
                <p className="font-semibold text-red-700 dark:text-red-400">
                  The check could not run
                </p>
                <p className="mt-1 text-red-700/90 dark:text-red-300/80">
                  {checkError}
                </p>
              </div>
            ) : (checking && !result) || !catalog ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
                <Skeleton className="h-64" />
              </>
            ) : result ? (
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
                <p className="text-xs text-muted">
                  Route and token data belongs to rhino.fi. Unofficial, not
                  affiliated with rhino.fi. Checked against live rhino.fi data.
                </p>
              </>
            ) : (
              <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted">
                  Set a requirement and press Check routes.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
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
