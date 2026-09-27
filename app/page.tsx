import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow-sm">
              🚢
            </div>
            <span className="font-bold text-xl tracking-tight">ShipLog</span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              v1.0
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/c/demo"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Public Portal
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground mb-8">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            AI-Powered Changelog Engine for Developers
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            From Merged Pull Requests to{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Viral Releases
            </span>{' '}
            in Seconds.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            ShipLog automatically listens to merged GitHub PRs, filters internal noise,
            transforms commit metadata into polished customer updates using Google Gemini 1.5 Flash,
            and serves updates via a zero-dependency &lt;5 KB widget.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90"
            >
              Open Dashboard
            </Link>
            <Link
              href="/c/demo"
              className="rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-card-foreground shadow-sm transition hover:bg-accent"
            >
              View Sample Changelog
            </Link>
          </div>

          {/* Quick Architecture Indicators */}
          <div className="mt-16 grid grid-cols-2 gap-4 text-left sm:grid-cols-4 sm:gap-6">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-2xl font-bold text-primary">0 ms</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                Noise Filter
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Strips chore, ci, style, and [skip] tags deterministically.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-2xl font-bold text-primary">Gemini 1.5</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                Flash Synthesis
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Strict JSON schema producing features, improvements & fixes.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-2xl font-bold text-primary">&lt; 5 KB</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                Embeddable Widget
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Zero-dependency isolated Shadow DOM client script.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-2xl font-bold text-primary">SSR Portal</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                Dynamic OG Cards
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Fast server-side rendered `/c/[slug]` changelog portals.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="border-t border-border bg-muted/20 py-16 sm:py-24">
          <div className="container mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Built for High-Velocity Product Teams
              </h2>
              <p className="mt-4 text-muted-foreground">
                Eliminate the chore of writing manual changelogs and newsletters.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 font-bold mb-4">
                  ⚡
                </div>
                <h3 className="font-semibold text-lg">Read-Only GitHub Ingestion</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Connect your repository with read-only webhooks. Merged PRs are automatically collected into an unreleased draft queue.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 font-bold mb-4">
                  ✨
                </div>
                <h3 className="font-semibold text-lg">Multi-Channel Syndication</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Generate customer newsletters and 3-part Twitter/X threads alongside your public release notes with one click.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold mb-4">
                  🛡️
                </div>
                <h3 className="font-semibold text-lg">Scoped Shadow DOM</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Embed our notification bell into any host SaaS without worrying about CSS leakage or style conflicts.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ShipLog SaaS Engine. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <Link href="/billing" className="hover:text-foreground">Pricing ($15/mo Pro)</Link>
            <Link href="/c/demo" className="hover:text-foreground">Demo Changelog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
