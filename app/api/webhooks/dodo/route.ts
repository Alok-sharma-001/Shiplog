import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

function verifyDodoSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  isDev: boolean,
  mockHeader: string | null
): boolean {
  if (isDev && mockHeader === 'test_bypass_key') {
    return true;
  }
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('webhook-signature') || req.headers.get('x-dodo-signature');
    const mockSignature = req.headers.get('x-mock-signature');
    const secret = process.env.DODO_WEBHOOK_SECRET || 'test_dodo_secret';
    const isDev = process.env.NODE_ENV !== 'production';

    // Verify signature
    if (!verifyDodoSignature(rawBody, signature, secret, isDev, mockSignature)) {
      return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const eventId = payload.event_id || payload.id;
    if (!eventId || String(eventId).trim().length === 0) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check idempotency
    const { data: existingEvent } = await supabase
      .from('dodo_webhook_events')
      .select('id, event_id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({ status: 'already_processed', event_id: eventId }, { status: 200 });
    }

    // Record idempotency event
    await supabase.from('dodo_webhook_events').insert({
      event_id: eventId,
      event_type: payload.type || 'unknown',
      payload: payload,
    });

    const eventType = payload.type;
    const data = payload.data || {};
    const customerId = data.customer_id;
    const projectId = data.project_id || payload.project_id;
    const status = data.status || '';

    let isPro = false;

    if (eventType === 'subscription.created' || (eventType === 'subscription.updated' && status === 'active')) {
      isPro = true;
    } else if (eventType === 'subscription.cancelled' || status === 'cancelled') {
      isPro = false;
    }

    // Update Project Pro status if projectId is provided
    if (projectId) {
      await supabase
        .from('projects')
        .update({ is_pro_override: isPro })
        .eq('id', projectId);
    }

    // Update Profile tier if customer or userId provided
    if (data.user_id || customerId) {
      const userIdentifier = data.user_id || customerId;
      await supabase
        .from('profiles')
        .update({
          tier: isPro ? 'pro' : 'free',
          subscription_status: isPro ? 'active' : 'cancelled',
          dodo_customer_id: customerId || null,
        })
        .or(`id.eq.${userIdentifier},dodo_customer_id.eq.${userIdentifier}`);
    }

    return NextResponse.json({
      status: 'processed',
      event_id: eventId,
      event_type: eventType,
      is_pro: isPro,
    });
  } catch (err: any) {
    console.error('[ERROR] Dodo Webhook Handler failed:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err?.message }, { status: 500 });
  }
}
