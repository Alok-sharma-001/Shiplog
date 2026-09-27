import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createMockSupabaseClient } from '@/tests/mocks/mock-supabase';

describe('Adversarial Database & Query Mock Stress Suite', () => {
  describe('1. Mock Query Builder — Chained Filtering & Predicates', () => {
    const fixtureProjects = [
      { id: 'p1', name: 'Alpha', slug: 'alpha', user_id: 'u1', is_pro_override: true, tags: ['core'] },
      { id: 'p2', name: 'Beta', slug: 'beta', user_id: 'u1', is_pro_override: false, tags: ['addon'] },
      { id: 'p3', name: 'Gamma', slug: 'gamma', user_id: 'u2', is_pro_override: false, tags: ['core'] },
      { id: 'p4', name: 'Delta', slug: 'delta', user_id: 'u3', is_pro_override: true, tags: [] },
    ];

    it('filters correctly with single .eq() predicate', async () => {
      const mockDb = createMockSupabaseClient({ projects: [...fixtureProjects] });
      const { data, error } = await mockDb.from('projects').select('*').eq('user_id', 'u1');
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data.map((p: any) => p.id)).toEqual(['p1', 'p2']);
    });

    it('filters correctly with chained multiple .eq() predicates (AND condition)', async () => {
      const mockDb = createMockSupabaseClient({ projects: [...fixtureProjects] });
      const { data, error } = await mockDb
        .from('projects')
        .select('*')
        .eq('user_id', 'u1')
        .eq('is_pro_override', true);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('p1');
    });

    it('filters correctly with .neq() predicate', async () => {
      const mockDb = createMockSupabaseClient({ projects: [...fixtureProjects] });
      const { data, error } = await mockDb.from('projects').select('*').neq('user_id', 'u1');
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data.map((p: any) => p.id)).toEqual(['p3', 'p4']);
    });

    it('filters correctly with .in() predicate against array of values', async () => {
      const mockDb = createMockSupabaseClient({ projects: [...fixtureProjects] });
      const { data, error } = await mockDb.from('projects').select('*').in('slug', ['alpha', 'gamma']);
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data.map((p: any) => p.slug)).toEqual(['alpha', 'gamma']);
    });

    it('filters correctly with .in() when given empty array (should match 0 rows)', async () => {
      const mockDb = createMockSupabaseClient({ projects: [...fixtureProjects] });
      const { data, error } = await mockDb.from('projects').select('*').in('slug', []);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('handles query on non-existent column without throwing runtime errors', async () => {
      const mockDb = createMockSupabaseClient({ projects: [...fixtureProjects] });
      const { data, error } = await mockDb.from('projects').select('*').eq('non_existent_column', 'xyz');
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  describe('2. Mock Query Builder — Sorting & Pagination', () => {
    const fixtureReleases = [
      { id: 'r1', version: 'v1.0.0', created_at: '2026-01-01T00:00:00Z', priority: 10 },
      { id: 'r2', version: 'v1.1.0', created_at: '2026-02-01T00:00:00Z', priority: 30 },
      { id: 'r3', version: 'v1.2.0', created_at: '2026-03-01T00:00:00Z', priority: 20 },
      { id: 'r4', version: 'v1.3.0', created_at: '2026-04-01T00:00:00Z', priority: null },
    ];

    it('sorts ascending and descending by string/date', async () => {
      const mockDb = createMockSupabaseClient({ changelogs: [...fixtureReleases] });
      const asc = await mockDb.from('changelogs').select('*').order('created_at', { ascending: true });
      expect(asc.data.map((r: any) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);

      const desc = await mockDb.from('changelogs').select('*').order('created_at', { ascending: false });
      expect(desc.data.map((r: any) => r.id)).toEqual(['r4', 'r3', 'r2', 'r1']);
    });

    it('paginates correctly using .limit()', async () => {
      const mockDb = createMockSupabaseClient({ changelogs: [...fixtureReleases] });
      const limited = await mockDb.from('changelogs').select('*').limit(2);
      expect(limited.data).toHaveLength(2);
      expect(limited.data[0].id).toBe('r1');
      expect(limited.data[1].id).toBe('r2');
    });

    it('handles .limit(0) by returning empty array', async () => {
      const mockDb = createMockSupabaseClient({ changelogs: [...fixtureReleases] });
      const zeroLimit = await mockDb.from('changelogs').select('*').limit(0);
      expect(zeroLimit.data).toHaveLength(0);
    });

    it('combines filtering, sorting, and limit correctly', async () => {
      const mockDb = createMockSupabaseClient({ changelogs: [...fixtureReleases] });
      const res = await mockDb
        .from('changelogs')
        .select('*')
        .neq('id', 'r1')
        .order('created_at', { ascending: false })
        .limit(2);

      expect(res.data).toHaveLength(2);
      expect(res.data.map((r: any) => r.id)).toEqual(['r4', 'r3']);
    });
  });

  describe('3. Mock Query Builder — Mutations & Chaining Semantics', () => {
    it('supports standalone .insert() returning newly inserted row', async () => {
      const mockDb = createMockSupabaseClient();
      const res = await mockDb.from('projects').insert({
        name: 'Project 1',
        slug: 'p-1',
      });

      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBeDefined();
      expect(res.data[0].created_at).toBeDefined();
      expect(res.data[0].name).toBe('Project 1');
    });

    it('supports batch .insert() of multiple rows', async () => {
      const mockDb = createMockSupabaseClient();
      const res = await mockDb.from('projects').insert([
        { name: 'Proj A', slug: 'a' },
        { name: 'Proj B', slug: 'b' },
      ]);

      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(2);
      expect(res.count).toBe(2);
    });

    it('supports chained .insert().select() preserving mutation action and returning inserted rows', async () => {
      // In Supabase JS v2, `.insert(payload).select()` is the canonical way to get back inserted row(s).
      const mockDb = createMockSupabaseClient();
      const res = await mockDb.from('projects').insert({ name: 'Chained Insert', slug: 'chained' }).select();

      // Verified: res.data returns inserted row
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('Chained Insert');
      expect(res.data[0].slug).toBe('chained');
      // Verified: store['projects'] received the inserted row
      const check = await mockDb.from('projects').select('*').eq('slug', 'chained');
      expect(check.data).toHaveLength(1);
      expect(check.data[0].name).toBe('Chained Insert');
    });

    it('supports chained .update().select() preserving mutation action and returning updated rows', async () => {
      // In Supabase JS v2, `.update(updates).eq(...).select()` returns the updated row.
      const mockDb = createMockSupabaseClient({
        projects: [{ id: 'p1', name: 'Original', slug: 'p1' }],
      });

      const res = await mockDb.from('projects').update({ name: 'Renamed' }).eq('id', 'p1').select();
      // Verified: returns updated row
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('Renamed');
      // Verified: database was updated
      const check = await mockDb.from('projects').select('*').eq('id', 'p1').single();
      expect(check.data.name).toBe('Renamed');
    });

    it('supports chained .delete().select() deleting matching rows and returning deleted rows', async () => {
      // In Supabase JS v2, `.delete().eq(...).select()` deletes matching rows and returns them.
      const mockDb = createMockSupabaseClient({
        projects: [{ id: 'p1', name: 'To Delete' }],
      });

      const res = await mockDb.from('projects').delete().eq('id', 'p1').select();
      // Verified: returns the deleted row
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('To Delete');
      // Verified: row was deleted from store
      const check = await mockDb.from('projects').select('*');
      expect(check.data).toHaveLength(0);
    });

    it('supports standalone .update() with .eq() filter', async () => {
      const mockDb = createMockSupabaseClient({
        projects: [{ id: 'p1', name: 'Original', slug: 'p1' }],
      });

      const res = await mockDb.from('projects').update({ name: 'Renamed' }).eq('id', 'p1');
      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data[0].name).toBe('Renamed');

      const verified = await mockDb.from('projects').select('*').eq('id', 'p1').single();
      expect(verified.data.name).toBe('Renamed');
    });

    it('ADVERSARIAL STRESS: .update() with NO filter updates all rows', async () => {
      const mockDb = createMockSupabaseClient({
        projects: [
          { id: 'p1', name: 'P1', status: 'active' },
          { id: 'p2', name: 'P2', status: 'active' },
        ],
      });

      const res = await mockDb.from('projects').update({ status: 'archived' });
      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(2);
      expect(res.data.every((r: any) => r.status === 'archived')).toBe(true);
    });

    it('supports .upsert() updating existing row with matching id', async () => {
      const mockDb = createMockSupabaseClient({
        profiles: [{ id: 'u1', email: 'old@example.com', tier: 'free' }],
      });

      const res = await mockDb.from('profiles').upsert({ id: 'u1', email: 'new@example.com', tier: 'pro' });
      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data[0].tier).toBe('pro');

      const check = await mockDb.from('profiles').select('*').eq('id', 'u1').single();
      expect(check.data.email).toBe('new@example.com');
      expect(check.data.tier).toBe('pro');
    });

    it('supports .upsert() deduplication on non-id unique constraint (idempotency)', async () => {
      // In dodo_webhook_events, the unique idempotency key is `event_id`, NOT `id`.
      const mockDb = createMockSupabaseClient();
      await mockDb.from('dodo_webhook_events').upsert({ event_id: 'evt_dup', event_type: 'subscription.created' });
      await mockDb.from('dodo_webhook_events').upsert({ event_id: 'evt_dup', event_type: 'subscription.created' });

      // Verified: 1 deduplicated row is stored
      const check = await mockDb.from('dodo_webhook_events').select('*').eq('event_id', 'evt_dup');
      expect(check.data).toHaveLength(1);
      expect(check.data[0].event_id).toBe('evt_dup');
    });

    it('supports standalone .delete() with .eq() filter', async () => {
      const mockDb = createMockSupabaseClient({
        projects: [
          { id: 'p1', name: 'Keep' },
          { id: 'p2', name: 'DeleteMe' },
        ],
      });

      const res = await mockDb.from('projects').delete().eq('id', 'p2');
      expect(res.error).toBeNull();
      expect(res.count).toBe(1);

      const remaining = await mockDb.from('projects').select('*');
      expect(remaining.data).toHaveLength(1);
      expect(remaining.data[0].id).toBe('p1');
    });

    it('ADVERSARIAL STRESS: .delete() with NO filter deletes all rows in table', async () => {
      const mockDb = createMockSupabaseClient({
        projects: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      });

      const res = await mockDb.from('projects').delete();
      expect(res.error).toBeNull();
      expect(res.count).toBe(3);

      const check = await mockDb.from('projects').select('*');
      expect(check.data).toHaveLength(0);
    });
  });

  describe('4. Mock Query Builder — Error Handling & Cardinality Semantics', () => {
    it('.single() on 0 rows returns PGRST116 error and null data', async () => {
      const mockDb = createMockSupabaseClient({ projects: [] });
      const res = await mockDb.from('projects').select('*').eq('id', 'nonexistent').single();
      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe('PGRST116');
    });

    it('.single() on exactly 1 row returns the item and null error', async () => {
      const mockDb = createMockSupabaseClient({
        projects: [{ id: 'p1', name: 'Single Project' }],
      });
      const res = await mockDb.from('projects').select('*').eq('id', 'p1').single();
      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();
      expect(res.data.id).toBe('p1');
    });

    it('.single() returns PGRST116 error and null data when multiple rows match', async () => {
      // In PostgREST / Supabase JS, .single() returns PGRST116 error if multiple rows match.
      const mockDb = createMockSupabaseClient({
        projects: [
          { id: 'p1', name: 'Dup', group: 'A' },
          { id: 'p2', name: 'Dup', group: 'A' },
        ],
      });
      const res = await mockDb.from('projects').select('*').eq('group', 'A').single();
      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe('PGRST116');
      expect(res.error?.message).toBe('JSON object requested, multiple rows returned');
      expect(res.count).toBe(2);
    });

    it('.maybeSingle() on 0 rows returns data: null and error: null', async () => {
      const mockDb = createMockSupabaseClient({ projects: [] });
      const res = await mockDb.from('projects').select('*').eq('id', 'empty').maybeSingle();
      expect(res.error).toBeNull();
      expect(res.data).toBeNull();
    });

    it('.maybeSingle() on 1 row returns the item and error: null', async () => {
      const mockDb = createMockSupabaseClient({
        projects: [{ id: 'p1', name: 'Found' }],
      });
      const res = await mockDb.from('projects').select('*').eq('id', 'p1').maybeSingle();
      expect(res.error).toBeNull();
      expect(res.data.name).toBe('Found');
    });

    it('.maybeSingle() returns PGRST116 error and null data when multiple rows match', async () => {
      // In PostgREST, .maybeSingle() only permits 0 or 1 row. >1 rows returns PGRST116 error.
      const mockDb = createMockSupabaseClient({
        projects: [
          { id: 'p1', name: 'M1', group: 'B' },
          { id: 'p2', name: 'M2', group: 'B' },
        ],
      });
      const res = await mockDb.from('projects').select('*').eq('group', 'B').maybeSingle();
      expect(res.data).toBeNull();
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe('PGRST116');
      expect(res.error?.message).toBe('JSON object requested, multiple rows returned');
      expect(res.count).toBe(2);
    });

    it('querying an uninitialized/arbitrary table returns empty array without throwing', async () => {
      const mockDb = createMockSupabaseClient();
      const res = await mockDb.from('custom_uninitialized_table').select('*');
      expect(res.error).toBeNull();
      expect(res.data).toEqual([]);
    });
  });

  describe('5. DDL & SQL Migration Adversarial Integrity Analysis', () => {
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const initialSql = fs.readFileSync(path.join(migrationsDir, '20260922000001_initial_schema.sql'), 'utf8');
    const rlsSql = fs.readFileSync(path.join(migrationsDir, '20260922000002_rls_policies.sql'), 'utf8');

    it('verifies cascading delete chains on all dependent child tables', () => {
      expect(initialSql).toMatch(/installations[\s\S]*?REFERENCES\s+public\.profiles\(id\)\s+ON DELETE CASCADE/i);
      expect(initialSql).toMatch(/projects[\s\S]*?user_id UUID NOT NULL REFERENCES\s+public\.profiles\(id\)\s+ON DELETE CASCADE/i);
      expect(initialSql).toMatch(/changelogs[\s\S]*?project_id UUID NOT NULL REFERENCES\s+public\.projects\(id\)\s+ON DELETE CASCADE/i);
      expect(initialSql).toMatch(/pull_requests[\s\S]*?project_id UUID NOT NULL REFERENCES\s+public\.projects\(id\)\s+ON DELETE CASCADE/i);
      expect(initialSql).toMatch(/changelog_id UUID REFERENCES\s+public\.changelogs\(id\)\s+ON DELETE SET NULL/i);
    });

    it('verifies critical unique constraints preventing duplicate data', () => {
      expect(initialSql).toMatch(/slug TEXT NOT NULL UNIQUE/i);
      expect(initialSql).toMatch(/CONSTRAINT\s+uq_user_repo\s+UNIQUE\s*\(\s*user_id\s*,\s*repo_full_name\s*\)/i);
      expect(initialSql).toMatch(/github_installation_id BIGINT NOT NULL UNIQUE/i);
      expect(initialSql).toMatch(/CONSTRAINT\s+uq_project_pr\s+UNIQUE\s*\(\s*project_id\s*,\s*pr_number\s*\)/i);
      expect(initialSql).toMatch(/event_id TEXT NOT NULL UNIQUE/i);
    });

    it('TRIGGER LOGIC RESOLVED: sync_pull_request_fields uses TG_OP = UPDATE and IS DISTINCT FROM to support release unlinking and un-exclusion', () => {
      // In sync_pull_request_fields:
      // Uses TG_OP = 'UPDATE' and IS DISTINCT FROM to properly detect field changes,
      // enabling unlinking (setting changelog_id = NULL) and un-excluding PRs.
      expect(initialSql).toContain("IF TG_OP = 'UPDATE' THEN");
      expect(initialSql).toContain('IF NEW.changelog_id IS DISTINCT FROM OLD.changelog_id THEN');
      expect(initialSql).toContain('ELSIF NEW.release_id IS DISTINCT FROM OLD.release_id THEN');
      expect(initialSql).toContain('IF NEW.status IS DISTINCT FROM OLD.status THEN');
      expect(initialSql).toContain('ELSIF NEW.is_filtered IS DISTINCT FROM OLD.is_filtered THEN');
    });

    it('TRIGGER LOGIC RESOLVED: sync_changelog_fields uses TG_OP = UPDATE and IS DISTINCT FROM for bidirectional sync', () => {
      // In sync_changelog_fields:
      // Uses TG_OP = 'UPDATE' and IS DISTINCT FROM to keep markdown_body and raw_markdown in sync,
      // as well as status and is_published.
      expect(initialSql).toContain("IF TG_OP = 'UPDATE' THEN");
      expect(initialSql).toContain('IF NEW.markdown_body IS DISTINCT FROM OLD.markdown_body THEN');
      expect(initialSql).toContain('ELSIF NEW.raw_markdown IS DISTINCT FROM OLD.raw_markdown THEN');
      expect(initialSql).toContain('IF NEW.status IS DISTINCT FROM OLD.status THEN');
      expect(initialSql).toContain('ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published THEN');
    });

    it('RLS CRITICAL AUDIT RESOLVED: verifies project secret protection and public RPC isolation', () => {
      // In 20260922000002_rls_policies.sql:
      // Project secrets (webhook_secret) are protected: universal read policy USING (true) is removed,
      // public access is mediated through get_project_public_info() security definer RPC,
      // and profile tiers are protected via protect_profile_tier() trigger.
      expect(rlsSql).not.toContain('USING (true);');
      expect(rlsSql).not.toContain('CREATE POLICY "Public read project info by slug"');
      expect(rlsSql).toContain('protect_profile_tier');
      expect(rlsSql).toContain('get_project_public_info');
    });
  });
});
