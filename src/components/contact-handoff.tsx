"use client";

import { CaretDown, Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";
import type { CheckResponse } from "@/lib/api";
import type { Requirement } from "@/lib/engine/types";
import { formatUsd } from "@/lib/format";

const ARRIVAL_LABEL: Record<Requirement["arrivalForm"], string> = {
  balance: "a balance",
  vault: "a vault position",
  "contract-call": "a contract call",
};

function buildEnquiry(
  requirement: Requirement & { amountUsd?: number },
  result: CheckResponse,
  chainName: (id: string) => string,
  contact: { name: string; email: string; company: string },
): string {
  const lines: string[] = [];
  const chains = requirement.depositChains.map(chainName).join(", ");

  lines.push("Requirement");
  lines.push(`  Deposit tokens: ${requirement.depositTokens.join(", ")}`);
  lines.push(`  Deposit chains: ${chains}`);
  lines.push(
    `  Settle: ${requirement.settlementToken} on ${chainName(requirement.settlementChain)}`,
  );
  lines.push(`  Funds arrive as: ${ARRIVAL_LABEL[requirement.arrivalForm]}`);
  if (requirement.amountUsd) {
    lines.push(`  Representative amount: ${formatUsd(requirement.amountUsd)}`);
  }

  lines.push("");
  lines.push("Result (checked against live rhino.fi data)");
  lines.push(
    `  ${result.summary.clear} clear, ${result.summary.extension} need an extension, ${result.summary.blocked} cannot be done`,
  );

  const needsExtension = result.routes.filter((r) => r.outcome === "extension");
  const blocked = result.routes.filter((r) => r.outcome === "blocked");
  for (const r of needsExtension) {
    lines.push(
      `  Needs an extension: ${r.depositToken} on ${chainName(r.depositChain)} (${r.reason})`,
    );
  }
  for (const r of blocked) {
    lines.push(
      `  Cannot be done: ${r.depositToken} on ${chainName(r.depositChain)} (${r.reason})`,
    );
  }
  if (result.extensions.length > 0) {
    lines.push(
      `  Extensions required: ${result.extensions.map((e) => e.name).join(", ")}`,
    );
  }

  lines.push("");
  lines.push("Contact");
  lines.push(`  Name: ${contact.name || "(not provided)"}`);
  lines.push(`  Email: ${contact.email || "(not provided)"}`);
  if (contact.company) lines.push(`  Company: ${contact.company}`);

  return lines.join("\n");
}

function ContactInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      />
    </div>
  );
}

export function ContactHandoff({
  requirement,
  result,
  chainName,
}: {
  requirement: Requirement & { amountUsd?: number };
  result: CheckResponse;
  chainName: (id: string) => string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [open, setOpen] = useState(false);

  const enquiry = buildEnquiry(requirement, result, chainName, {
    name,
    email,
    company,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(enquiry);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">
            Take this to rhino.fi
          </span>
          <span className="block text-xs text-muted">
            A scoped enquiry covering the routes and the extensions, ready to
            copy into the rhino.fi contact form.
          </span>
        </span>
        <CaretDown
          size={16}
          weight="bold"
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="border-t border-border p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ContactInput
              id="contact-name"
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Jordan Alvarez"
            />
            <ContactInput
              id="contact-email"
              label="Work email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="jordan@company.com"
            />
            <ContactInput
              id="contact-company"
              label="Company (optional)"
              value={company}
              onChange={setCompany}
              placeholder="Company"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-[0.99]"
            >
              {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy enquiry"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
            >
              {showPreview ? "Hide preview" : "Preview"}
            </button>
          </div>

          {showPreview ? (
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-4 font-sans text-xs leading-relaxed text-foreground/80">
              {enquiry}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
