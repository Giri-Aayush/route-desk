"use client";

import { useEffect, useState } from "react";
import type { CheckResponse } from "@/lib/api";
import { fetchQuote } from "@/lib/api";
import type { ExtensionNeed, Outcome, RouteVerdict } from "@/lib/engine/types";
import type { RhinoQuote } from "@/lib/rhino/types";
import { formatTime, formatUsd } from "@/lib/format";

type QuoteState =
  | { status: "loading" }
  | { status: "done"; quote: RhinoQuote }
  | { status: "unavailable"; reason: string }
  | { status: "error" };

const routeKey = (r: { depositChain: string; depositToken: string }) =>
  `${r.depositChain}:${r.depositToken}`;

const STATUS: Record<Outcome, { label: string; dot: string; text: string }> = {
  clear: {
    label: "Clear",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  extension: { label: "Needs an extension", dot: "bg-brand", text: "text-brand" },
  blocked: {
    label: "Cannot be done",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
};

function StatusLabel({ outcome }: { outcome: Outcome }) {
  const s = STATUS[outcome];
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-medium ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

function CostLine({ state }: { state?: QuoteState }) {
  if (!state || state.status === "loading") {
    return <span className="text-xs text-muted">fetching cost</span>;
  }
  if (state.status === "unavailable" || state.status === "error") {
    return <span className="text-xs text-muted">cost unavailable</span>;
  }
  const { quote } = state;
  return (
    <span className="text-xs tabular-nums text-muted">
      fee {formatUsd(quote.fees.feeUsd)}, receive {formatUsd(quote.receiveAmountUsd)}
    </span>
  );
}

function Cell({ route, quote }: { route: RouteVerdict; quote?: QuoteState }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StatusLabel outcome={route.outcome} />
      {route.outcome === "clear" ? (
        <CostLine state={quote} />
      ) : (
        <p className="text-xs leading-relaxed text-muted">{route.reason}</p>
      )}
      {route.outcome === "clear" && route.limits ? (
        <p className="text-xs tabular-nums text-muted/70">
          min {formatUsd(route.limits.minUsd)}
        </p>
      ) : null}
    </div>
  );
}

function RouteGrid({
  routes,
  chainName,
  quotes,
}: {
  routes: RouteVerdict[];
  chainName: (id: string) => string;
  quotes: Record<string, QuoteState>;
}) {
  const chains = [...new Set(routes.map((r) => r.depositChain))];
  const tokens = [...new Set(routes.map((r) => r.depositToken))];
  const find = (c: string, t: string) =>
    routes.find((r) => r.depositChain === c && r.depositToken === t);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2.5 pr-4 text-xs font-medium text-muted">
              Deposit chain
            </th>
            {tokens.map((t) => (
              <th
                key={t}
                className="px-4 py-2.5 text-sm font-semibold text-foreground"
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chains.map((c) => (
            <tr key={c} className="border-b border-border/50 last:border-0">
              <th
                scope="row"
                className="whitespace-nowrap py-4 pr-4 align-top text-sm font-medium text-foreground"
              >
                {chainName(c)}
              </th>
              {tokens.map((t) => {
                const r = find(c, t);
                return (
                  <td key={t} className="min-w-[13rem] px-4 py-4 align-top">
                    {r ? <Cell route={r} quote={quotes[routeKey(r)]} /> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExtensionsList({ extensions }: { extensions: ExtensionNeed[] }) {
  return (
    <div>
      <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        Extensions this requirement needs
      </h3>
      <p className="mt-0.5 text-sm text-muted">
        Each is triggered by a specific part of the request.
      </p>
      <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
        {extensions.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              {e.name}
            </span>
            <span className="text-xs text-muted sm:max-w-[58%] sm:text-right">
              {e.trigger}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Results({
  result,
  chainName,
  settlementChain,
  settlementToken,
  amount,
}: {
  result: CheckResponse;
  chainName: (id: string) => string;
  settlementChain: string;
  settlementToken: string;
  amount: string;
}) {
  // Parent remounts this component per check (keyed by result), so the initial
  // loading map is derived from props here and the effect only runs async work.
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>(() =>
    Object.fromEntries(
      result.routes
        .filter((r) => r.outcome === "clear")
        .map((r) => [routeKey(r), { status: "loading" } as QuoteState]),
    ),
  );
  const [quotesFetchedAt, setQuotesFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    const clears = result.routes.filter((r) => r.outcome === "clear");
    if (clears.length === 0) return;

    const controller = new AbortController();

    Promise.all(
      clears.map(async (r) => {
        try {
          const resp = await fetchQuote(
            {
              chainIn: r.depositChain,
              chainOut: settlementChain,
              tokenIn: r.depositToken,
              tokenOut: settlementToken,
              amount,
              isSda: true,
            },
            controller.signal,
          );
          setQuotes((prev) => ({
            ...prev,
            [routeKey(r)]: resp.available
              ? { status: "done", quote: resp.quote }
              : { status: "unavailable", reason: resp.reason },
          }));
        } catch {
          if (controller.signal.aborted) return;
          setQuotes((prev) => ({ ...prev, [routeKey(r)]: { status: "error" } }));
        }
      }),
    ).then(() => {
      if (!controller.signal.aborted) {
        setQuotesFetchedAt(new Date().toISOString());
      }
    });

    return () => controller.abort();
  }, [result, settlementChain, settlementToken, amount]);

  const total =
    result.summary.clear + result.summary.extension + result.summary.blocked;
  const sublineParts: string[] = [];
  if (result.summary.extension > 0) {
    sublineParts.push(
      `${result.summary.extension} ${result.summary.extension === 1 ? "needs" : "need"} an extension`,
    );
  }
  if (result.summary.blocked > 0) {
    sublineParts.push(`${result.summary.blocked} cannot be done`);
  }
  const subline =
    sublineParts.length > 0
      ? `${sublineParts.join(", ")}.`
      : "Every route works as it is.";

  return (
    <section className="flex flex-col gap-6" aria-live="polite">
      {!result.settlement.ok && result.settlement.reason ? (
        <div className="rounded-r-lg border-l-2 border-red-500 bg-red-500/5 py-3 pl-4 pr-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Settlement blocked
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {result.settlement.reason}. Nothing downstream can complete, so every
            route is blocked.
          </p>
        </div>
      ) : null}

      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {result.summary.clear} of {total} routes are clear.
        </h2>
        <p className="mt-1 text-sm text-muted">{subline}</p>
      </div>

      <RouteGrid routes={result.routes} chainName={chainName} quotes={quotes} />

      {quotesFetchedAt ? (
        <p className="text-xs text-muted">
          Costs fetched at {formatTime(quotesFetchedAt)}. Fees change, so treat
          them as indicative.
        </p>
      ) : null}

      {result.extensions.length > 0 ? (
        <ExtensionsList extensions={result.extensions} />
      ) : null}
    </section>
  );
}
