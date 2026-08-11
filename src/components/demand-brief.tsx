"use client";

import { Check, CircleNotch, Copy, Sparkle } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { AiUnconfiguredError, fetchAiBrief } from "@/lib/api";

export function DemandBrief() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setText(await fetchAiBrief());
    } catch (e) {
      if (e instanceof AiUnconfiguredError) {
        setUnconfigured(true);
        return;
      }
      setError(e instanceof Error ? e.message : "Could not draft the brief.");
    } finally {
      setLoading(false);
    }
  }, []);

  const copy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the text is selectable
    }
  }, [text]);

  if (unconfigured) {
    return (
      <p className="text-sm text-muted">
        Set the AI provider&apos;s key on the server to turn this demand into a
        written brief.
      </p>
    );
  }

  if (text) {
    return (
      <div>
        <div className="flex items-center justify-end gap-1">
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
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-foreground/[0.05] hover:text-foreground disabled:opacity-50"
          >
            {loading ? "Rewriting" : "Regenerate"}
          </button>
        </div>
        <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-4 font-sans text-sm leading-relaxed text-foreground">
          {text}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/[0.04] disabled:opacity-50"
      >
        {loading ? (
          <CircleNotch size={15} weight="bold" className="animate-spin" />
        ) : (
          <Sparkle size={15} weight="bold" />
        )}
        {loading ? "Writing the brief" : "Write the brief with AI"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
