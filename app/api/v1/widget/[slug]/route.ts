import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkShouldShowViralBadge } from '@/lib/billing/tier-limits';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
  'Cache-Control': 'public, max-age=60, s-maxage=300',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || slug.trim().length === 0) {
      return NextResponse.json(
        { error: 'Project slug parameter is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = createAdminClient();

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, slug, is_pro_override, user_id')
      .eq('slug', slug)
      .maybeSingle();

    if (!project) {
      // If project not in DB, return empty releases array gracefully with 200 OK
      return NextResponse.json(
        {
          project: {
            name: slug,
            slug,
            is_pro: false,
            show_badge: true,
          },
          releases: [],
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Determine Pro tier status
    let isPro = Boolean(project.is_pro_override);
    if (!isPro && project.user_id) {
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

    // Fetch published changelogs
    const { data: changelogs } = await supabase
      .from('changelogs')
      .select('id, version_tag, release_title, overview_summary, categories, published_at, is_published, status')
      .eq('project_id', project.id)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(20);

    const releases = (changelogs || []).map((c: any) => ({
      id: c.id,
      version_tag: c.version_tag,
      release_title: c.release_title,
      overview_summary: c.overview_summary,
      categories: c.categories || { features: [], improvements: [], fixes: [] },
      published_at: c.published_at,
    }));

    return NextResponse.json(
      {
        project: {
          name: project.name,
          slug: project.slug,
          is_pro: isPro,
          show_badge: showBadge,
        },
        releases,
      },
      {
        status: 200,
        headers: CORS_HEADERS,
      }
    );
  } catch (err: any) {
    console.error('[ERROR] Widget API route failed:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err?.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
