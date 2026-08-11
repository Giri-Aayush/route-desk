"use client";

import { Check, Copy } from "@phosphor-icons/react";
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
      <label
        htmlFor={id}
        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
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
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Take this to rhino.fi
      </h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Copy the scoped enquiry below and send it through the rhino.fi contact
        form. It arrives already covering the routes and the extensions.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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

      <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        {enquiry}
      </pre>

      <button
        type="button"
        onClick={copy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy enquiry"}
      </button>
    </section>
  );
}
