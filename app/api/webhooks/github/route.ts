import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { evaluatePRNoise } from '@/lib/ingestion/noise-filter';
import { createAdminClient } from '@/lib/supabase/admin';

function verifyGitHubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const signature = signatureHeader.slice(7);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || 'test_webhook_secret';

    // Verify cryptographic signature if secret is configured and not in test bypass
    const bypassHeader = req.headers.get('x-mock-signature');
    const isDev = process.env.NODE_ENV !== 'production';

    if (!(isDev && bypassHeader === 'test_bypass_key')) {
      if (!signature || !verifyGitHubSignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // Only process pull_request events where action is 'closed' and PR is merged
    const action = payload.action;
    const pr = payload.pull_request;
    const repo = payload.repository;

    if (!pr || action !== 'closed' || !pr.merged) {
      return NextResponse.json({
        message: 'Event ignored: not a merged pull request closed event',
        action,
        merged: pr?.merged ?? false,
      });
    }

    const prNumber = pr.number;
    const title = pr.title;
    const body = pr.body;
    const author = pr.user?.login || 'unknown';
    const labels = Array.isArray(pr.labels)
      ? pr.labels.map((l: any) => (typeof l === 'string' ? l : l.name))
      : [];

    // Evaluate noise
    const noiseResult = evaluatePRNoise({
      pr_number: prNumber,
      title,
      body,
      author,
      labels,
    });

    const supabase = createAdminClient();
    const repoFullName = repo?.full_name || 'unknown/repo';

    // Look up corresponding project by repo_name
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, slug')
      .or(`repo_name.eq.${repoFullName},slug.eq.${repo?.name || ''}`)
      .limit(1)
      .maybeSingle();

    const projectId = project?.id || 'default_project_id';

    // Insert into pull_requests table
    const { data: inserted, error: insertError } = await supabase
      .from('pull_requests')
      .upsert(
        {
          project_id: projectId,
          pr_number: prNumber,
          title,
          body,
          author,
          labels,
          status: noiseResult.isNoise ? 'filtered' : 'unreleased',
          is_filtered: noiseResult.isNoise,
          filter_reason: noiseResult.reason || null,
          merged_at: pr.merged_at || new Date().toISOString(),
          raw_payload: payload,
        },
        { onConflict: 'project_id,pr_number' }
      )
      .select()
      .maybeSingle();

    return NextResponse.json({
      success: true,
      pr_number: prNumber,
      is_noise: noiseResult.isNoise,
      noise_rule: noiseResult.matchedRule,
      status: noiseResult.isNoise ? 'filtered' : 'unreleased',
      record: inserted || null,
    });
  } catch (err: any) {
    console.error('[ERROR] GitHub Webhook Handler failed:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err?.message }, { status: 500 });
  }
}
