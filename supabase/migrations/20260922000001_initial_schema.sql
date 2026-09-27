-- Migration: 20260922000001_initial_schema.sql
-- Description: Core tables, indexes, extensions, and trigger functions for ShipLog

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Profiles Table (Founder Profiles linked to Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    dodo_customer_id TEXT,
    dodo_subscription_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'inactive'
        CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'past_due', 'on_hold')),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Backward-compatibility View: public.users aliased to public.profiles
-- security_invoker = true ensures RLS policies of invoker are evaluated
CREATE OR REPLACE VIEW public.users WITH (security_invoker = true) AS
SELECT
    id,
    email,
    full_name AS name,
    tier,
    dodo_subscription_id AS subscription_id,
    dodo_customer_id,
    subscription_status,
    current_period_end,
    created_at,
    updated_at
FROM public.profiles;

-- ============================================================================
-- 2. Installations Table (GitHub App Organization/User Installations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    github_installation_id BIGINT NOT NULL UNIQUE,
    account_login TEXT NOT NULL,
    account_id BIGINT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'User' CHECK (account_type IN ('User', 'Organization')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. Projects Table (Connected Repositories & Changelog Portals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    installation_id UUID REFERENCES public.installations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    repo_full_name TEXT NOT NULL,
    webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    is_pro_override BOOLEAN NOT NULL DEFAULT FALSE,
    custom_domain TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_repo UNIQUE (user_id, repo_full_name)
);

-- ============================================================================
-- 4. Changelogs Table (Synthesized AI & Published Releases)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.changelogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    version_tag TEXT NOT NULL,
    release_title TEXT NOT NULL,
    overview_summary TEXT NOT NULL,
    categories JSONB NOT NULL DEFAULT '{"features":[], "improvements":[], "fixes":[]}'::jsonb,
    distribution JSONB NOT NULL DEFAULT '{"email_plain_text":"", "social_post_thread":[]}'::jsonb,
    raw_markdown TEXT NOT NULL DEFAULT '',
    markdown_body TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 5. Pull Requests Table (Ingested GitHub PR Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pull_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    changelog_id UUID REFERENCES public.changelogs(id) ON DELETE SET NULL,
    release_id UUID REFERENCES public.changelogs(id) ON DELETE SET NULL,
    github_pr_id BIGINT,
    pr_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    author TEXT NOT NULL DEFAULT '',
    author_login TEXT NOT NULL DEFAULT '',
    author_avatar_url TEXT,
    pr_url TEXT NOT NULL DEFAULT '',
    merged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_filtered BOOLEAN NOT NULL DEFAULT FALSE,
    filter_reason TEXT,
    status TEXT NOT NULL DEFAULT 'unreleased'
        CHECK (status IN ('unreleased', 'released', 'excluded', 'queued', 'included', 'filtered')),
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_project_pr UNIQUE (project_id, pr_number)
);

-- ============================================================================
-- 6. Dodo Webhook Events (Payment Idempotency Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dodo_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 7. High-Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_installations_user ON public.installations(user_id);
CREATE INDEX IF NOT EXISTS idx_installations_github ON public.installations(github_installation_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_repo_full_name ON public.projects(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_pull_requests_project_status ON public.pull_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_pull_requests_project_merged ON public.pull_requests(project_id, merged_at DESC);
CREATE INDEX IF NOT EXISTS idx_pull_requests_changelog_id ON public.pull_requests(changelog_id);
CREATE INDEX IF NOT EXISTS idx_changelogs_project_published ON public.changelogs(project_id, is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelogs_published_at ON public.changelogs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_dodo_events_event_id ON public.dodo_webhook_events(event_id);

-- ============================================================================
-- 8. Triggers & Utility Functions
-- ============================================================================

-- Generic updated_at timestamp updater
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_installations_updated_at
    BEFORE UPDATE ON public.installations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_changelogs_updated_at
    BEFORE UPDATE ON public.changelogs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_pull_requests_updated_at
    BEFORE UPDATE ON public.pull_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Synchronize Changelogs fields (is_published <-> status, raw_markdown <-> markdown_body)
CREATE OR REPLACE FUNCTION public.sync_changelog_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Synchronize status & is_published based on which field changed
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            NEW.is_published = (NEW.status = 'published');
        ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
            IF NEW.is_published = TRUE THEN
                NEW.status = 'published';
            ELSE
                NEW.status = 'draft';
            END IF;
        END IF;

        -- Synchronize markdown body & raw_markdown based on which field changed
        IF NEW.markdown_body IS DISTINCT FROM OLD.markdown_body THEN
            NEW.raw_markdown = NEW.markdown_body;
        ELSIF NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown THEN
            NEW.markdown_body = NEW.raw_markdown;
        END IF;
    ELSE -- TG_OP = 'INSERT'
        -- Initialize status & is_published
        IF NEW.is_published = TRUE THEN
            NEW.status = 'published';
        ELSIF NEW.status = 'published' THEN
            NEW.is_published = TRUE;
        ELSE
            NEW.is_published = FALSE;
            NEW.status = 'draft';
        END IF;

        -- Initialize markdown fields
        IF NEW.markdown_body IS NOT NULL AND NEW.markdown_body <> '' AND (NEW.raw_markdown IS NULL OR NEW.raw_markdown = '') THEN
            NEW.raw_markdown = NEW.markdown_body;
        ELSIF NEW.raw_markdown IS NOT NULL AND NEW.raw_markdown <> '' AND (NEW.markdown_body IS NULL OR NEW.markdown_body = '') THEN
            NEW.markdown_body = NEW.raw_markdown;
        END IF;
    END IF;

    -- Automatically maintain published_at timestamp
    IF NEW.is_published = TRUE THEN
        IF NEW.published_at IS NULL THEN
            NEW.published_at = timezone('utc'::text, now());
        END IF;
    ELSE
        NEW.published_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_changelog_fields
    BEFORE INSERT OR UPDATE ON public.changelogs
    FOR EACH ROW EXECUTE FUNCTION public.sync_changelog_fields();

-- Synchronize Pull Request fields (author <-> author_login, changelog_id <-> release_id, status <-> is_filtered)
CREATE OR REPLACE FUNCTION public.sync_pull_request_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Author sync on UPDATE
        IF NEW.author_login IS DISTINCT FROM OLD.author_login THEN
            NEW.author = NEW.author_login;
        ELSIF NEW.author IS DISTINCT FROM OLD.author THEN
            NEW.author_login = NEW.author;
        END IF;

        -- Release / Changelog ID sync on UPDATE (handles unlinking cleanly)
        IF NEW.changelog_id IS DISTINCT FROM OLD.changelog_id THEN
            NEW.release_id = NEW.changelog_id;
        ELSIF NEW.release_id IS DISTINCT FROM OLD.release_id THEN
            NEW.changelog_id = NEW.release_id;
        END IF;

        -- Status & noise filter sync on UPDATE
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status IN ('excluded', 'filtered') THEN
                NEW.is_filtered = TRUE;
            ELSE
                NEW.is_filtered = FALSE;
            END IF;
        ELSIF NEW.is_filtered IS DISTINCT FROM OLD.is_filtered THEN
            IF NEW.is_filtered = TRUE THEN
                NEW.status = 'excluded';
            ELSE
                IF NEW.status IN ('excluded', 'filtered') THEN
                    NEW.status = 'unreleased';
                END IF;
            END IF;
        END IF;
    ELSE -- TG_OP = 'INSERT'
        -- Author sync on INSERT
        IF NEW.author_login IS NOT NULL AND NEW.author_login <> '' AND (NEW.author IS NULL OR NEW.author = '') THEN
            NEW.author = NEW.author_login;
        ELSIF NEW.author IS NOT NULL AND NEW.author <> '' AND (NEW.author_login IS NULL OR NEW.author_login = '') THEN
            NEW.author_login = NEW.author;
        END IF;

        -- Release / Changelog ID sync on INSERT
        IF NEW.changelog_id IS NOT NULL AND NEW.release_id IS NULL THEN
            NEW.release_id = NEW.changelog_id;
        ELSIF NEW.release_id IS NOT NULL AND NEW.changelog_id IS NULL THEN
            NEW.changelog_id = NEW.release_id;
        END IF;

        -- Status & noise filter sync on INSERT
        IF NEW.is_filtered = TRUE AND NEW.status NOT IN ('excluded', 'filtered') THEN
            NEW.status = 'excluded';
        ELSIF NEW.status IN ('excluded', 'filtered') THEN
            NEW.is_filtered = TRUE;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_pull_request_fields
    BEFORE INSERT OR UPDATE ON public.pull_requests
    FOR EACH ROW EXECUTE FUNCTION public.sync_pull_request_fields();

-- Supabase Auth Auto-provision profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
