import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Creates a service-role Supabase client bypassing Row-Level Security (RLS).
 * MUST ONLY be used in backend webhooks, background tasks, and seed scripts.
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://mock.supabase.co';
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
