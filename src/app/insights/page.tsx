import Link from "next/link";
import type { ReactNode } from "react";
import { DemandBrief } from "@/components/demand-brief";
import { aggregate } from "@/lib/analytics/aggregate";
import { readChecks } from "@/lib/analytics/store";
import type { CountRow, DemandRow } from "@/lib/analytics/types";
import { getBridgeConfigs } from "@/lib/rhino/client";

export const metadata = { title: "Demand insights - Route Desk" };

// Reads the captured checks at request time.
export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "no data";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-heading text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DemandList({
  rows,
  nameOf,
  tone,
}: {
  rows: DemandRow[];
  nameOf: (id: string) => string;
  tone: "blocked" | "extension";
}) {
  const dot = tone === "blocked" ? "bg-red-500" : "bg-brand";
  return (
    <ul className="divide-y divide-border/60 border-t border-border/60">
      {rows.map((r) => (
        <li key={`${r.token}-${r.chain}`} className="flex items-center gap-4 py-3">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium text-foreground">
                {r.token} on {nameOf(r.chain)}
              </span>
              <span className="shrink-0 font-heading text-base font-semibold tabular-nums text-foreground">
                {r.count}
                <span className="ml-1 text-xs font-normal text-muted">
                  {r.count === 1 ? "request" : "requests"}
                </span>
              </span>
            </div>
            {r.reason ? (
              <p className="mt-0.5 truncate text-xs text-muted">{r.reason}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function RankGroup({
  title,
  rows,
  label,
}: {
  title?: string;
  rows: CountRow[];
  label: (key: string) => string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      {title ? (
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      ) : null}
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <span
              className="min-w-0 flex-1 truncate text-sm text-muted"
              title={label(r.key)}
            >
              {label(r.key)}
            </span>
            <span className="hidden h-1 w-16 rounded-full bg-foreground/[0.06] sm:block">
              <span
                className="block h-full rounded-full bg-brand/60"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-foreground">
              {r.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function InsightsPage() {
  const events = await readChecks();
  const insights = aggregate(events);

  let names: Record<string, string> = {};
  try {
    const configs = await getBridgeConfigs();
    names = Object.fromEntries(
      Object.entries(configs).map(([id, c]) => [id, c.name]),
    );
  } catch {
    // fall back to raw ids
  }
  const nameOf = (id: string) => names[id] ?? id;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="h-5 w-5 rounded-md bg-gradient-to-br from-brand to-brand-strong"
              aria-hidden
            />
            <span className="text-sm font-medium text-muted">Route Desk</span>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Demand insights
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            What prospects ask to route, drawn from every check. Built for the
            sales and BD teams to see where the demand is, and where it goes
            unmet.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-brand hover:text-brand-strong"
        >
          Back to the checker
        </Link>
      </header>

      {insights.totalChecks === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted">
            No checks recorded yet. Run a few in the checker and they will show up
            here.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            <Stat label="Checks" value={insights.totalChecks.toLocaleString()} />
            <Stat
              label="Routes checked"
              value={insights.totalRoutes.toLocaleString()}
            />
            <Stat
              label="Clear"
              value={`${Math.round(insights.clearRate * 100)}%`}
            />
            <Stat label="Since" value={formatDate(insights.since)} />
          </section>

          <Section
            title="Weekly brief"
            subtitle="A written summary of the demand below, for a standup or a planning doc."
          >
            <DemandBrief />
          </Section>

          <Section
            title="Requested but not supported"
            subtitle="The strongest signals for what to build next. Each is a route a prospect asked for that rhino.fi cannot serve today."
          >
            {insights.unmetDemand.length === 0 ? (
              <p className="text-sm text-muted">
                No blocked routes yet. Everything asked for so far is supported.
              </p>
            ) : (
              <DemandList
                rows={insights.unmetDemand}
                nameOf={nameOf}
                tone="blocked"
              />
            )}
          </Section>

          {insights.needsExtension.length > 0 ? (
            <Section
              title="Gated behind a paid extension"
              subtitle="Routes prospects asked for that need an extension. Demand for the paid catalogue."
            >
              <DemandList
                rows={insights.needsExtension}
                nameOf={nameOf}
                tone="extension"
              />
            </Section>
          ) : null}

          <Section title="Where the demand is" subtitle="Across every check.">
            <div className="grid gap-8 sm:grid-cols-3">
              <RankGroup
                title="Deposit chains"
                rows={insights.topDepositChains}
                label={nameOf}
              />
              <RankGroup
                title="Deposit tokens"
                rows={insights.topDepositTokens}
                label={(k) => k}
              />
              <RankGroup
                title="Settlement targets"
                rows={insights.topSettlements.map((s) => ({
                  key: `${s.token} on ${nameOf(s.chain)}`,
                  count: s.count,
                }))}
                label={(k) => k}
              />
            </div>
          </Section>

          {insights.topExtensions.length > 0 ? (
            <Section
              title="Extensions most needed"
              subtitle="How often each paid extension is triggered."
            >
              <div className="max-w-md">
                <RankGroup rows={insights.topExtensions} label={(k) => k} />
              </div>
            </Section>
          ) : null}
        </>
      )}

      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted">
        Route and token data belongs to rhino.fi. This tool is unofficial. Insights
        are drawn from checks run in this tool.
      </footer>
    </div>
  );
}
