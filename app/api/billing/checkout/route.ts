import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const CheckoutRequestSchema = z.object({
  project_id: z.string().min(1, 'project_id is required'),
  return_url: z.string().url('return_url must be a valid URL').optional(),
  plan_id: z.string().optional().default('plan_pro_monthly_15'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = CheckoutRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid checkout parameters', details: result.error.errors },
        { status: 400 }
      );
    }

    const { project_id, return_url, plan_id } = result.data;
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;

    if (!apiKey || apiKey.startsWith('mock') || process.env.NODE_ENV !== 'production') {
      // Deterministic simulation checkout session
      const mockCheckoutId = 'chk_' + Math.random().toString(36).substring(2, 9);
      const fallbackReturn = return_url || `/dashboard?project=${project_id}&upgrade=success`;
      const checkoutUrl = `https://test.checkout.dodopayments.com/buy/${plan_id}?checkout_id=${mockCheckoutId}&project_id=${project_id}&redirect_url=${encodeURIComponent(fallbackReturn)}`;

      return NextResponse.json({
        success: true,
        checkout_id: mockCheckoutId,
        checkout_url: checkoutUrl,
        mode: 'mock',
        plan: {
          id: plan_id,
          name: 'ShipLog Pro Plan',
          price_usd: 15.0,
          interval: 'month',
        },
      });
    }

    // Live Dodo Payments Checkout API call
    const dodoResponse = await fetch('https://api.dodopayments.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: plan_id,
        metadata: { project_id },
        return_url: return_url || 'https://shiplog.dev/dashboard?status=success',
      }),
    });

    if (!dodoResponse.ok) {
      const errText = await dodoResponse.text();
      return NextResponse.json(
        { error: 'Dodo Payments provider error', details: errText },
        { status: dodoResponse.status }
      );
    }

    const data = await dodoResponse.json();
    return NextResponse.json({
      success: true,
      checkout_id: data.subscription_id || data.id,
      checkout_url: data.payment_link || data.url,
      mode: 'live',
    });
  } catch (err: any) {
    console.error('[ERROR] Checkout creation failed:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err?.message }, { status: 500 });
  }
}
