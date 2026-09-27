-- Empirical Stress & Security Verification Test
\set ON_ERROR_STOP on

-- Setup test users
TRUNCATE auth.users CASCADE;
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"full_name": "Alice Free"}'),
    ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"full_name": "Bob Free"}');

-- Grant access on public tables to roles for RLS evaluation
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon, service_role;

-- 1. Alice creates her project
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.projects (id, user_id, name, slug, repo_owner, repo_name, repo_full_name, webhook_secret)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'Alice Project',
    'alice-project',
    'alice',
    'project',
    'alice/project',
    'secret_alice_super_secure_key'
);

-- 2. Bob creates his project
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.projects (id, user_id, name, slug, repo_owner, repo_name, repo_full_name, webhook_secret)
VALUES (
    'b2222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'Bob Project',
    'bob-project',
    'bob',
    'project',
    'bob/project',
    'secret_bob_super_secure_key'
);

-- 3. TEST RLS ISOLATION: Bob queries projects
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.projects;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'RLS LEAK! Bob expected 1 project, saw %', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.projects WHERE user_id = '11111111-1111-1111-1111-111111111111';
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS LEAK! Bob can see Alice project!';
    END IF;
    RAISE NOTICE 'TEST 1 PASSED: Multi-tenant project isolation verified for authenticated user.';
END $$;

-- 4. TEST ANON ACCESS: Anon cannot read projects table directly
SET ROLE anon;
SET request.jwt.claim.role = 'anon';
RESET request.jwt.claim.sub;

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.projects;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS LEAK! Anon can read public.projects table! Count: %', v_count;
    END IF;
    RAISE NOTICE 'TEST 2 PASSED: Anon role is denied direct SELECT on public.projects.';
END $$;

-- 5. TEST PUBLIC RPC FUNCTION: Anon can safely query sanitized project info
DO $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT * INTO v_rec FROM public.get_project_public_info('alice-project');
    IF v_rec.name <> 'Alice Project' OR v_rec.slug <> 'alice-project' THEN
        RAISE EXCEPTION 'Public RPC failed to return Alice Project';
    END IF;
    RAISE NOTICE 'TEST 3 PASSED: get_project_public_info() works for anon and returns sanitized data.';
END $$;

-- 6. TEST PRIVILEGE ESCALATION BLOCK: Alice attempts to elevate to Pro
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

DO $$
BEGIN
    BEGIN
        UPDATE public.profiles SET tier = 'pro' WHERE id = '11111111-1111-1111-1111-111111111111';
        RAISE EXCEPTION 'CRITICAL SECURITY VULNERABILITY! Alice was able to self-promote to Pro tier!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Unauthorized: Billing tier%' THEN
            RAISE NOTICE 'TEST 4 PASSED: Tier escalation successfully blocked by protect_profile_tier()!';
        ELSE
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
    END;
END $$;

-- 7. TEST LEGITIMATE PROFILE UPDATE: Alice updates display name
UPDATE public.profiles SET full_name = 'Alice Champion' WHERE id = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_name TEXT;
BEGIN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';
    IF v_name <> 'Alice Champion' THEN
        RAISE EXCEPTION 'Legitimate profile update failed!';
    END IF;
    RAISE NOTICE 'TEST 5 PASSED: Legitimate profile update (full_name) succeeded.';
END $$;

-- 8. TEST SERVICE ROLE BILLING UPGRADE: Service role can update tier
SET ROLE service_role;
SET request.jwt.claim.role = 'service_role';
RESET request.jwt.claim.sub;

UPDATE public.profiles
SET tier = 'pro', subscription_status = 'active', dodo_subscription_id = 'sub_123'
WHERE id = '11111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_tier TEXT;
    v_status TEXT;
BEGIN
    SELECT tier, subscription_status INTO v_tier, v_status FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';
    IF v_tier <> 'pro' OR v_status <> 'active' THEN
        RAISE EXCEPTION 'Service role upgrade failed!';
    END IF;
    RAISE NOTICE 'TEST 6 PASSED: Service role successfully upgraded profile tier to pro.';
END $$;

-- 9. TEST CHANGELOG UNPUBLISHING TRIGGER
SET ROLE authenticated;
SET request.jwt.claim.role = 'authenticated';
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.changelogs (id, project_id, version_tag, release_title, overview_summary, is_published, markdown_body)
VALUES (
    'c1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'v1.0.0',
    'Initial Release',
    'First version',
    TRUE,
    '# First Release'
);

-- Verify it was published
DO $$
DECLARE
    v_published BOOLEAN;
    v_status TEXT;
BEGIN
    SELECT is_published, status INTO v_published, v_status FROM public.changelogs WHERE id = 'c1111111-1111-1111-1111-111111111111';
    IF v_published <> TRUE OR v_status <> 'published' THEN
        RAISE EXCEPTION 'Changelog insert failed to initialize as published!';
    END IF;
END $$;

-- Now unpublish by updating is_published = FALSE
UPDATE public.changelogs SET is_published = FALSE WHERE id = 'c1111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_published BOOLEAN;
    v_status TEXT;
BEGIN
    SELECT is_published, status INTO v_published, v_status FROM public.changelogs WHERE id = 'c1111111-1111-1111-1111-111111111111';
    IF v_published <> FALSE OR v_status <> 'draft' THEN
        RAISE EXCEPTION 'TRIGGER BUG: Unpublishing was trapped! is_published: %, status: %', v_published, v_status;
    END IF;
    RAISE NOTICE 'TEST 7 PASSED: Changelog unpublishing succeeded without trigger state traps.';
END $$;

-- 10. TEST PULL REQUEST UNLINKING & NOISE UN-EXCLUSION
INSERT INTO public.pull_requests (id, project_id, pr_number, title, changelog_id, is_filtered, status)
VALUES (
    'aa111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    101,
    'Fix bug',
    'c1111111-1111-1111-1111-111111111111',
    TRUE,
    'excluded'
);

-- Verify release_id was synchronized with changelog_id
DO $$
DECLARE
    v_rel UUID;
BEGIN
    SELECT release_id INTO v_rel FROM public.pull_requests WHERE id = 'aa111111-1111-1111-1111-111111111111';
    IF v_rel <> 'c1111111-1111-1111-1111-111111111111' THEN
        RAISE EXCEPTION 'Sync release_id failed on insert!';
    END IF;
END $$;

-- Unlink PR from changelog
UPDATE public.pull_requests SET changelog_id = NULL WHERE id = 'aa111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_cl UUID;
    v_rel UUID;
BEGIN
    SELECT changelog_id, release_id INTO v_cl, v_rel FROM public.pull_requests WHERE id = 'aa111111-1111-1111-1111-111111111111';
    IF v_cl IS NOT NULL OR v_rel IS NOT NULL THEN
        RAISE EXCEPTION 'TRIGGER BUG: PR unlinking was trapped! changelog_id: %, release_id: %', v_cl, v_rel;
    END IF;
    RAISE NOTICE 'TEST 8 PASSED: PR unlinking succeeded without trigger state traps.';
END $$;

-- Un-exclude PR by setting status = 'unreleased'
UPDATE public.pull_requests SET status = 'unreleased' WHERE id = 'aa111111-1111-1111-1111-111111111111';

DO $$
DECLARE
    v_filtered BOOLEAN;
    v_status TEXT;
BEGIN
    SELECT is_filtered, status INTO v_filtered, v_status FROM public.pull_requests WHERE id = 'aa111111-1111-1111-1111-111111111111';
    IF v_filtered <> FALSE OR v_status <> 'unreleased' THEN
        RAISE EXCEPTION 'TRIGGER BUG: PR un-exclusion was trapped! is_filtered: %, status: %', v_filtered, v_status;
    END IF;
    RAISE NOTICE 'TEST 9 PASSED: PR un-exclusion succeeded without trigger state traps.';
END $$;
