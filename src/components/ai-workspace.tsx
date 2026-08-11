"use client";

import {
  ArrowRight,
  Check,
  CircleNotch,
  Copy,
  Warning,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import {
  AiUnconfiguredError,
  fetchAiParse,
  fetchAiReply,
  fetchAiStatus,
  fetchCatalog,
  fetchCheck,
  type AiParseResponse,
  type CheckResponse,
} from "@/lib/api";
import type { Catalog } from "@/lib/engine/catalog";

const EXAMPLE =
  "We take USDT and USDC from Ethereum, Polygon, Tron and Solana, and want it all to settle as USDC on Base.";

type Phase = "idle" | "parsing" | "checking" | "done";

const OUTCOME = {
  clear: { dot: "bg-emerald-500", text: "text-emerald-600", label: "Clear" },
  extension: { dot: "bg-brand", text: "text-brand", label: "Needs an extension" },
  blocked: { dot: "bg-red-500", text: "text-red-600", label: "Not supported" },
} as const;

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-xs font-medium text-foreground/75">
      {children}
    </span>
  );
}

export function AiWorkspace() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<AiParseResponse | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchCatalog(ctrl.signal)
      .then(setCatalog)
      .catch(() => {});
    fetchAiStatus(ctrl.signal)
      .then(setConfigured)
      .catch(() => setConfigured(false));
    return () => ctrl.abort();
  }, []);

  const nameOf = useCallback(
    (id: string) => catalog?.chains[id]?.name ?? id,
    [catalog],
  );

  const run = useCallback(async () => {
    if (!message.trim() || !catalog) return;
    setError(null);
    setReply(null);
    setResult(null);
    setParsed(null);
    setPhase("parsing");
    try {
      const p = await fetchAiParse(message);
      setParsed(p);
      const req = p.requirement;
      if (
        req.depositChains.length === 0 ||
        req.depositTokens.length === 0 ||
        !req.settlementChain ||
        !req.settlementToken
      ) {
        setPhase("done");
        setError(
          "Not enough was recognised to run a check. Name the deposit chains, the tokens, and where funds should settle.",
        );
        return;
      }
      setPhase("checking");
      const r = await fetchCheck({ ...req, amountUsd: p.amountUsd ?? undefined });
      setResult(r);
      setPhase("done");
    } catch (e) {
      setPhase("done");
      if (e instanceof AiUnconfiguredError) {
        setConfigured(false);
        return;
      }
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [message, catalog]);

  const draft = useCallback(async () => {
    if (!parsed || !result || !catalog) return;
    setDrafting(true);
    setError(null);
    try {
      const names = Object.fromEntries(
        Object.entries(catalog.chains).map(([id, c]) => [id, c.name]),
      );
      setReply(
        await fetchAiReply({ requirement: parsed.requirement, result, names }),
      );
    } catch (e) {
      if (e instanceof AiUnconfiguredError) {
        setConfigured(false);
        return;
      }
      setError(e instanceof Error ? e.message : "Could not draft a reply.");
    } finally {
      setDrafting(false);
    }
  }, [parsed, result, catalog]);

  const copy = useCallback(async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the text is selectable in the preview
    }
  }, [reply]);

  if (configured === false) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          The AI workspace needs a key
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Set <code className="text-foreground">ANTHROPIC_API_KEY</code> in the
          server environment and reload. The checker and insights work without
          it; this page is the only part that calls Claude.
        </p>
        <p className="mt-3 text-xs text-muted">
          The model reads a prospect&apos;s message into a requirement and drafts
          the reply. It never decides feasibility: the rule engine and live
          rhino.fi data still make every yes/no call.
        </p>
      </div>
    );
  }

  const busy = phase === "parsing" || phase === "checking";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label
          htmlFor="intake"
          className="text-sm font-medium text-foreground"
        >
          What the prospect asked for
        </label>
        <p className="mt-1 text-xs text-muted">
          Paste their message. Claude reads it into a requirement and runs the
          live check.
        </p>
        <textarea
          id="intake"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder={EXAMPLE}
          className="mt-3 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground placeholder:text-muted/70 focus:border-brand focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy || !message.trim() || !catalog}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? (
              <>
                <CircleNotch size={15} weight="bold" className="animate-spin" />
                {phase === "parsing" ? "Reading" : "Checking"}
              </>
            ) : (
              <>
                <ArrowRight size={15} weight="bold" />
                Parse &amp; check
              </>
            )}
          </button>
          {message.trim() ? null : (
            <button
              type="button"
              onClick={() => setMessage(EXAMPLE)}
              className="text-xs font-medium text-muted transition hover:text-foreground"
            >
              Use an example
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 border-l-2 border-red-500 bg-red-500/5 py-2.5 pl-3 pr-4">
          <Warning
            size={15}
            weight="bold"
            className="mt-0.5 shrink-0 text-red-600"
          />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      ) : null}

      {parsed ? (
        <div className="border-t border-border pt-5">
          <h2 className="text-sm font-medium text-foreground">
            What Claude read
          </h2>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Deposit chains</span>
              {parsed.requirement.depositChains.map((c) => (
                <Chip key={c}>{nameOf(c)}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Tokens</span>
              {parsed.requirement.depositTokens.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Settle as</span>
              <Chip>
                {parsed.requirement.settlementToken} on{" "}
                {nameOf(parsed.requirement.settlementChain)}
              </Chip>
              <span className="text-xs text-muted">Arrival</span>
              <Chip>{parsed.requirement.arrivalForm}</Chip>
              {parsed.amountUsd ? (
                <>
                  <span className="text-xs text-muted">Size</span>
                  <Chip>${parsed.amountUsd.toLocaleString()}</Chip>
                </>
              ) : null}
            </div>
          </div>
          {parsed.notes ? (
            <p className="mt-3 text-xs text-muted">{parsed.notes}</p>
          ) : null}
          {parsed.unmapped.length > 0 ? (
            <p className="mt-2 text-xs text-brand">
              Not recognised, left out of the check: {parsed.unmapped.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="border-t border-border pt-5">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {result.summary.clear} of {result.routes.length} routes are clear.
          </h2>
          {result.settlement.ok ? null : (
            <p className="mt-1 text-sm text-red-600">{result.settlement.reason}</p>
          )}
          <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
            {result.routes.map((r) => {
              const o = OUTCOME[r.outcome];
              return (
                <li
                  key={`${r.depositChain}-${r.depositToken}`}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <span className="text-sm text-foreground">
                    {r.depositToken} from {nameOf(r.depositChain)}
                  </span>
                  <span className="flex items-center gap-2 text-right">
                    {r.reason ? (
                      <span className="hidden text-xs text-muted sm:inline">
                        {r.reason}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-medium ${o.text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${o.dot}`}
                        aria-hidden
                      />
                      {o.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {result.extensions.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              Extensions this needs:{" "}
              {result.extensions.map((e) => e.name).join(", ")}
            </p>
          ) : null}

          <div className="mt-5">
            {reply ? (
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">
                    Draft reply
                  </h3>
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-foreground/[0.05] hover:text-foreground"
                  >
                    {copied ? (
                      <Check size={14} weight="bold" />
                    ) : (
                      <Copy size={14} weight="bold" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-4 font-sans text-sm leading-relaxed text-foreground">
                  {reply}
                </pre>
                <button
                  type="button"
                  onClick={draft}
                  disabled={drafting}
                  className="mt-2 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
                >
                  {drafting ? "Redrafting" : "Redraft"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={draft}
                disabled={drafting}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:opacity-50"
              >
                {drafting ? (
                  <CircleNotch size={15} weight="bold" className="animate-spin" />
                ) : null}
                {drafting ? "Drafting reply" : "Draft a reply to the prospect"}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
