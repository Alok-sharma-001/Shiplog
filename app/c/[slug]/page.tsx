import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkShouldShowViralBadge } from '@/lib/billing/tier-limits';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('name, slug')
    .eq('slug', slug)
    .maybeSingle();

  const projectName = project?.name || slug;

  const { data: latestRelease } = await supabase
    .from('changelogs')
    .select('release_title, overview_summary, version_tag')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const title = latestRelease
    ? `${latestRelease.release_title} | ${projectName} Changelog`
    : `${projectName} Changelog`;
  const description =
    latestRelease?.overview_summary || `Latest updates, release notes, and improvements for ${projectName}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://shiplog.dev/c/${slug}`,
      images: [
        {
          url: `https://shiplog.dev/api/og?title=${encodeURIComponent(title)}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function PublicChangelogPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, slug, is_pro_override, user_id')
    .eq('slug', slug)
    .maybeSingle();

  const projectName = project?.name || slug;
  let isPro = Boolean(project?.is_pro_override);

  if (!isPro && project?.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', project.user_id)
      .maybeSingle();
    if (profile?.tier === 'pro') {
      isPro = true;
    }
  }

  const showBadge = checkShouldShowViralBadge(isPro);

  const { data: rawChangelogs } = await supabase
    .from('changelogs')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  const changelogs = (rawChangelogs || []).filter(
    (c: any) => !project || c.project_id === project.id
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl space-y-8">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{projectName} Changelog</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              New updates, bug fixes, and performance improvements.
            </p>
          </div>
          <Badge variant="outline" className="text-xs px-3 py-1">
            Live Feed
          </Badge>
        </header>

        {/* Timeline */}
        <main className="space-y-8">
          {changelogs.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              <p>No published releases yet. Check back soon for new updates!</p>
            </Card>
          ) : (
            changelogs.map((release: any) => {
              const categories = release.content || { features: [], improvements: [], fixes: [] };
              const pubDate = release.published_at
                ? new Date(release.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Recent';

              return (
                <article
                  key={release.id}
                  className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-800 space-y-4"
                  data-version={release.version_tag}
                >
                  {/* Timeline Indicator Dot */}
                  <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-slate-50 dark:border-slate-950" />

                  {/* Header Meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {release.version_tag}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">•</span>
                    <time className="text-sm text-slate-500 dark:text-slate-400">{pubDate}</time>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">{release.title}</h2>
                    <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {release.summary}
                    </p>
                  </div>

                  {/* Categories Breakdown */}
                  <div className="space-y-3 pt-2">
                    {categories.features?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          <span className="badge-feature">🚀 New Features</span>
                        </div>
                        <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                          {categories.features.map((f: any, idx: number) => {
                            const title = typeof f === 'string' ? f : f.title;
                            const desc = typeof f === 'object' && f.description ? `: ${f.description}` : '';
                            return (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">•</span>
                                <span>
                                  <strong>{title}</strong>
                                  {desc}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {categories.improvements?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          <span className="badge-improvement">⚡ Improvements</span>
                        </div>
                        <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                          {categories.improvements.map((imp: any, idx: number) => {
                            const title = typeof imp === 'string' ? imp : imp.title;
                            const desc = typeof imp === 'object' && imp.description ? `: ${imp.description}` : '';
                            return (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-500 font-bold">•</span>
                                <span>
                                  <strong>{title}</strong>
                                  {desc}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {categories.fixes?.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          <span className="badge-fix">🛠️ Bug Fixes</span>
                        </div>
                        <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                          {categories.fixes.map((fx: any, idx: number) => {
                            const title = typeof fx === 'string' ? fx : fx.title;
                            const desc = typeof fx === 'object' && fx.description ? `: ${fx.description}` : '';
                            return (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-amber-500 font-bold">•</span>
                                <span>
                                  <strong>{title}</strong>
                                  {desc}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </main>

        {/* Footer & Viral Loop Badge */}
        <footer className="pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
          {showBadge && (
            <div className="viral-badge inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              <span>Powered by</span>
              <a
                href="https://shiplog.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 hover:underline"
              >
                ShipLog
              </a>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
