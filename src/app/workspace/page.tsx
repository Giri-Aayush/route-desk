import Link from "next/link";
import { AiWorkspace } from "@/components/ai-workspace";

export const metadata = { title: "BD workspace - Route Desk" };

export default function WorkspacePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
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
            BD workspace
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Paste what a prospect asked for. Claude reads it into a requirement and
            runs the live check; the reply is drafted from the verified result,
            never beyond it.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-brand hover:text-brand-strong"
        >
          Back to the checker
        </Link>
      </header>
      <div className="mt-8">
        <AiWorkspace />
      </div>
    </div>
  );
}
