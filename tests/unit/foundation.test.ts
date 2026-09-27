import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Utilities
import { cn, formatDate, truncate } from '@/lib/utils';

// UI Primitives
import { buttonVariants } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Toast, ToastProvider, ToastTitle } from '@/components/ui/toast';
import { Tooltip, TooltipProvider, TooltipContent } from '@/components/ui/tooltip';

// Supabase Factories & Mock Harness
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMockSupabaseClient } from '@/tests/mocks/mock-supabase';

describe('Milestone 1 Foundation Verification Suite', () => {
  describe('1. Database Schema & Migration SQL Verification', () => {
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const initialSchemaPath = path.join(migrationsDir, '20260922000001_initial_schema.sql');
    const rlsPoliciesPath = path.join(migrationsDir, '20260922000002_rls_policies.sql');

    it('should have initial schema migration file present and valid', () => {
      expect(fs.existsSync(initialSchemaPath)).toBe(true);
      const sql = fs.readFileSync(initialSchemaPath, 'utf8');

      // Verify all 6 core tables are declared
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.profiles');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.installations');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.projects');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.changelogs');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.pull_requests');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.dodo_webhook_events');

      // Verify foreign key integrity & cascades
      expect(sql).toContain('REFERENCES auth.users(id) ON DELETE CASCADE');
      expect(sql).toContain('REFERENCES public.projects(id) ON DELETE CASCADE');

      // Verify required performance indexes
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug)');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_pull_requests_project_status ON public.pull_requests(project_id, status)');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_changelogs_project_published ON public.changelogs(project_id, is_published, published_at DESC)');
    });

    it('should have RLS policies migration file present and valid', () => {
      expect(fs.existsSync(rlsPoliciesPath)).toBe(true);
      const sql = fs.readFileSync(rlsPoliciesPath, 'utf8');

      // Verify RLS is enabled on all tables
      expect(sql).toContain('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE public.dodo_webhook_events ENABLE ROW LEVEL SECURITY;');

      // Verify multi-tenant isolation and public changelog access
      expect(sql).toContain('auth.uid() = id');
      expect(sql).toContain('auth.uid() = user_id');
      expect(sql).toContain('Public read published changelogs');
      expect(sql).toContain('is_published = true');
    });
  });

  describe('2. Utility Functions (lib/utils.ts)', () => {
    it('cn() correctly merges classes and eliminates Tailwind conflicts', () => {
      expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
      expect(cn('px-2', false && 'hidden', 'text-sm')).toBe('px-2 text-sm');
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4'); // Tailwind merge conflict resolution
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('formatDate() formats timestamps cleanly', () => {
      const formatted = formatDate('2026-09-22T12:00:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Sep');
    });

    it('truncate() truncates text beyond maximum length', () => {
      expect(truncate('Short', 10)).toBe('Short');
      expect(truncate('This is a very long release title that should be shortened', 20)).toBe(
        'This is a very long ...'
      );
    });
  });

  describe('3. UI Primitives Instantiation & Variants', () => {
    it('buttonVariants generates correct classes for all variants and sizes', () => {
      const defaultBtn = buttonVariants();
      expect(defaultBtn).toContain('bg-primary');
      expect(defaultBtn).toContain('h-9');

      const destructiveBtn = buttonVariants({ variant: 'destructive', size: 'sm' });
      expect(destructiveBtn).toContain('bg-destructive');
      expect(destructiveBtn).toContain('h-8');

      const outlineBtn = buttonVariants({ variant: 'outline', size: 'lg' });
      expect(outlineBtn).toContain('border-input');
      expect(outlineBtn).toContain('h-10');

      const iconBtn = buttonVariants({ size: 'icon' });
      expect(iconBtn).toContain('h-9 w-9');
    });

    it('badgeVariants includes ShipLog domain categories and noise variants', () => {
      const featureBadge = badgeVariants({ variant: 'feature' });
      expect(featureBadge).toContain('text-emerald');

      const improvementBadge = badgeVariants({ variant: 'improvement' });
      expect(improvementBadge).toContain('text-blue');

      const fixBadge = badgeVariants({ variant: 'fix' });
      expect(fixBadge).toContain('text-amber');

      const noiseBadge = badgeVariants({ variant: 'noise' });
      expect(noiseBadge).toContain('bg-muted');
    });

    it('all primitive components are defined and exportable', () => {
      expect(Card).toBeDefined();
      expect(CardHeader).toBeDefined();
      expect(CardTitle).toBeDefined();
      expect(CardDescription).toBeDefined();
      expect(CardContent).toBeDefined();
      expect(CardFooter).toBeDefined();
      expect(Input).toBeDefined();
      expect(Textarea).toBeDefined();
      expect(Separator).toBeDefined();
      expect(Dialog).toBeDefined();
      expect(DialogContent).toBeDefined();
      expect(DialogTrigger).toBeDefined();
      expect(Tabs).toBeDefined();
      expect(TabsList).toBeDefined();
      expect(TabsTrigger).toBeDefined();
      expect(TabsContent).toBeDefined();
      expect(Toast).toBeDefined();
      expect(ToastProvider).toBeDefined();
      expect(ToastTitle).toBeDefined();
      expect(Tooltip).toBeDefined();
      expect(TooltipProvider).toBeDefined();
      expect(TooltipContent).toBeDefined();
    });
  });

  describe('4. Supabase Client Factories & Mock Query Harness', () => {
    it('browser client factory returns valid client object with from and auth methods', () => {
      const client = createBrowserClient();
      expect(client).toBeDefined();
      expect(typeof client.from).toBe('function');
      expect(client.auth).toBeDefined();
    });

    it('admin client factory returns valid service-role client', () => {
      const adminClient = createAdminClient();
      expect(adminClient).toBeDefined();
      expect(typeof adminClient.from).toBe('function');
      expect(adminClient.auth).toBeDefined();
    });

    it('mock client harness supports CRUD and query chaining offline', async () => {
      const mockDb = createMockSupabaseClient();

      // Insert project
      const { data: inserted, error: insertError } = await mockDb.from('projects').insert({
        name: 'ShipLog Demo',
        slug: 'shiplog-demo',
        repo_owner: 'owner',
        repo_name: 'repo',
        repo_full_name: 'owner/repo',
        user_id: 'user_123',
      });

      expect(insertError).toBeNull();
      expect(inserted).toHaveLength(1);
      expect(inserted[0].slug).toBe('shiplog-demo');

      // Query project by slug
      const { data: queried, error: queryError } = await mockDb
        .from('projects')
        .select('*')
        .eq('slug', 'shiplog-demo')
        .single();

      expect(queryError).toBeNull();
      expect(queried.name).toBe('ShipLog Demo');

      // Query non-existent project
      const { data: notFound, error: notFoundError } = await mockDb
        .from('projects')
        .select('*')
        .eq('slug', 'non-existent')
        .single();

      expect(notFound).toBeNull();
      expect(notFoundError).toBeDefined();
    });
  });
});
