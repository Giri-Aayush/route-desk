export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-widest text-foreground/50">
          Route Desk
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Check what rhino.fi can route, live.
        </h1>
        <p className="max-w-prose text-lg text-foreground/70">
          Describe a requirement and get a straight answer: which routes are clear,
          which need an extension, and which cannot be done, with the reason for each.
          Answers are computed from the rhino.fi API, not a table kept by hand.
        </p>
      </div>
      <p className="text-sm text-foreground/50">The checker is being built.</p>
      <p className="text-xs text-foreground/40">
        Unofficial. Chain and token data belongs to rhino.fi.
      </p>
    </main>
  );
}
