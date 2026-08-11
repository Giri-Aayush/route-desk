"use client";

import { CheckCircle, Warning, XCircle } from "@phosphor-icons/react";
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

const STATUS: Record<
  Outcome,
  { label: string; Icon: typeof CheckCircle; cls: string }
> = {
  clear: {
    label: "Clear",
    Icon: CheckCircle,
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
  },
  extension: {
    label: "Needs an extension",
    Icon: Warning,
    cls: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25",
  },
  blocked: {
    label: "Cannot be done",
    Icon: XCircle,
    cls: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20",
  },
};

function StatusBadge({ outcome }: { outcome: Outcome }) {
  const s = STATUS[outcome];
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.cls}`}
    >
      <Icon size={14} weight="fill" />
      {s.label}
    </span>
  );
}

function CostLine({ state }: { state?: QuoteState }) {
  if (!state || state.status === "loading") {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        fetching cost
      </span>
    );
  }
  if (state.status === "unavailable" || state.status === "error") {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        cost unavailable
      </span>
    );
  }
  const { quote } = state;
  return (
    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
      fee {formatUsd(quote.fees.feeUsd)}, receive{" "}
      {formatUsd(quote.receiveAmountUsd)}
    </span>
  );
}

function Cell({ route, quote }: { route: RouteVerdict; quote?: QuoteState }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StatusBadge outcome={route.outcome} />
      {route.outcome === "clear" ? (
        <CostLine state={quote} />
      ) : (
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {route.reason}
        </p>
      )}
      {route.outcome === "clear" && route.limits ? (
        <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          min {formatUsd(route.limits.minUsd)}
        </p>
      ) : null}
    </div>
  );
}

function Tile({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: Outcome;
}) {
  const color = {
    clear: "text-emerald-600 dark:text-emerald-400",
    extension: "text-amber-600 dark:text-amber-400",
    blocked: "text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`font-mono text-3xl font-semibold ${color}`}>{n}</div>
      <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
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
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="p-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Deposit chain
            </th>
            {tokens.map((t) => (
              <th
                key={t}
                className="p-3 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chains.map((c) => (
            <tr
              key={c}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
            >
              <th
                scope="row"
                className="whitespace-nowrap p-3 align-top text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                {chainName(c)}
              </th>
              {tokens.map((t) => {
                const r = find(c, t);
                return (
                  <td key={t} className="min-w-[13rem] p-3 align-top">
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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-100 p-4 dark:border-zinc-800/60">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Extensions this requirement needs
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Each is triggered by a specific part of the request.
        </p>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {extensions.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-0.5 p-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {e.name}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 sm:max-w-[58%] sm:text-right">
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

  return (
    <section className="flex flex-col gap-6" aria-live="polite">
      {!result.settlement.ok && result.settlement.reason ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/25 dark:bg-rose-500/10">
          <XCircle
            size={20}
            weight="fill"
            className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400"
          />
          <div>
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
              Settlement blocked
            </p>
            <p className="text-sm text-rose-700/90 dark:text-rose-300/80">
              {result.settlement.reason}. Nothing downstream can complete, so
              every route is blocked.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <Tile n={result.summary.clear} label="Clear" tone="clear" />
        <Tile
          n={result.summary.extension}
          label="Need an extension"
          tone="extension"
        />
        <Tile
          n={result.summary.blocked}
          label="Cannot be done"
          tone="blocked"
        />
      </div>

      <RouteGrid
        routes={result.routes}
        chainName={chainName}
        quotes={quotes}
      />

      {quotesFetchedAt ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
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
