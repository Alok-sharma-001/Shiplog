-- Migration: 20260922000002_rls_policies.sql
-- Description: Multi-tenant Row-Level Security (RLS) policies and security triggers for ShipLog

-- Enable RLS on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dodo_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. Profiles Table Policies & Anti-Escalation Security Trigger
-- ============================================================================
-- Authenticated users can view their own profile
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Authenticated users can update their own profile (display fields only; guarded by trigger below)
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Authenticated users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Security Trigger: Prevent unauthorized privilege escalation on public.profiles
-- Prevents authenticated users from self-promoting to 'pro' tier or modifying subscription metadata.
-- Only the service_role (or superuser postgres/supabase_admin) can update billing columns.
CREATE OR REPLACE FUNCTION public.protect_profile_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- If caller is not service_role (neither by JWT claim nor by DB role) and not superuser/admin
    IF (
        COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
        AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
    ) THEN
        IF NEW.tier IS DISTINCT FROM OLD.tier OR
           NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
           NEW.dodo_subscription_id IS DISTINCT FROM OLD.dodo_subscription_id OR
           NEW.dodo_customer_id IS DISTINCT FROM OLD.dodo_customer_id OR
           NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
            RAISE EXCEPTION 'Unauthorized: Billing tier, subscription status, and payment identifiers can only be modified by the service role.';
        END IF;

        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Unauthorized: User ID cannot be modified.';
        END IF;

        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            NEW.created_at = OLD.created_at;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_tier ON public.profiles;
CREATE TRIGGER trg_protect_profile_tier
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_tier();

-- ============================================================================
-- 2. Installations Table Policies
-- ============================================================================
-- Users can view their own GitHub installations
CREATE POLICY "Users can view own installations"
    ON public.installations FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own installations
CREATE POLICY "Users can insert own installations"
    ON public.installations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own installations
CREATE POLICY "Users can update own installations"
    ON public.installations FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own installations
CREATE POLICY "Users can delete own installations"
    ON public.installations FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Projects Table Policies (Strict Multi-Tenant Isolation)
-- ============================================================================
-- Users can view ONLY their own projects in the SaaS dashboard
CREATE POLICY "Users can view own projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can create new projects for themselves
CREATE POLICY "Users can insert own projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- NOTE: Universal read policy "Public read project info by slug" (USING (true)) has been
-- REMOVED to eliminate the universal multi-tenant leak and prevent webhook_secret scraping.
-- Public routes (/c/[slug] & /api/v1/widget/[slug]) query sanitized project info
-- via createAdminClient() or the get_project_public_info() security definer RPC below.

-- ============================================================================
-- 3.1 Public Project Info Access (Sanitized Security Definer RPC)
-- ============================================================================
-- Safe public function to query project info by slug without exposing webhook_secret or user_id
CREATE OR REPLACE FUNCTION public.get_project_public_info(p_slug TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    is_pro_override BOOLEAN,
    custom_domain TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        p.id,
        p.name,
        p.slug,
        p.is_pro_override,
        p.custom_domain
    FROM public.projects p
    WHERE p.slug = p_slug
    LIMIT 1;
$$;

-- Grant execution to anon, authenticated, and service_role
REVOKE EXECUTE ON FUNCTION public.get_project_public_info(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_project_public_info(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- 4. Pull Requests Table Policies
-- ============================================================================
-- Project owners can view PRs belonging to their projects
CREATE POLICY "Project owners can view pull requests"
    ON public.pull_requests FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pull_requests.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- Project owners can insert PRs into their projects
CREATE POLICY "Project owners can insert pull requests"
    ON public.pull_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pull_requests.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- Project owners can update PRs (e.g. toggle exclusion or status)
CREATE POLICY "Project owners can update pull requests"
    ON public.pull_requests FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pull_requests.project_id
              AND projects.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pull_requests.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- Project owners can delete PRs from their queue
CREATE POLICY "Project owners can delete pull requests"
    ON public.pull_requests FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pull_requests.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- 5. Changelogs Table Policies
-- ============================================================================
-- Project owners have full management permissions on draft and published changelogs
CREATE POLICY "Project owners can view changelogs"
    ON public.changelogs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = changelogs.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- Project owners can insert changelogs
CREATE POLICY "Project owners can insert changelogs"
    ON public.changelogs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = changelogs.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- Project owners can update changelogs
CREATE POLICY "Project owners can update changelogs"
    ON public.changelogs FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = changelogs.project_id
              AND projects.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = changelogs.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- Project owners can delete changelogs
CREATE POLICY "Project owners can delete changelogs"
    ON public.changelogs FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = changelogs.project_id
              AND projects.user_id = auth.uid()
        )
    );

-- Public read access: Anyone (anon or authenticated) can view PUBLISHED changelogs
CREATE POLICY "Public read published changelogs"
    ON public.changelogs FOR SELECT
    TO anon, authenticated
    USING (is_published = true OR status = 'published');

-- ============================================================================
-- 6. Dodo Webhook Events Policies
-- ============================================================================
-- No policies defined for 'anon' or 'authenticated' roles.
-- Only the service_role (used by /api/webhooks/dodo via lib/supabase/admin.ts)
-- bypasses RLS to insert and read payment idempotency events.
