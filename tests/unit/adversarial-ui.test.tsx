import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Utilities
import { cn, formatDate, truncate } from '@/lib/utils';

// UI Primitives
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastVariants,
  type ToastProps,
  type ToastActionElement,
} from '@/components/ui/toast';
import { Toaster } from '@/components/ui/toaster';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { useToast, toast, reducer } from '@/components/ui/use-toast';


describe('Adversarial Stress Test: UI Primitives & SSR', () => {
  describe('1. cn() Extreme Conditions & Tailwind Merge Conflicts', () => {
    it('handles falsy, null, undefined, empty, and NaN inputs gracefully', () => {
      expect(cn()).toBe('');
      expect(cn('')).toBe('');
      expect(cn(null)).toBe('');
      expect(cn(undefined)).toBe('');
      expect(cn(false)).toBe('');
      expect(cn(0 as any)).toBe('');
      expect(cn(NaN as any)).toBe('');
      expect(cn(null, undefined, false, '', 'valid')).toBe('valid');
    });

    it('handles deeply nested arrays and conditional structures', () => {
      const nested = [
        'base',
        ['level1', [null, ['level3', false && 'hidden', ['level4']]]],
        { active: true, disabled: false, invisible: null },
      ];
      const result = cn(nested as any);
      expect(result).toBe('base level1 level3 level4 active');
    });

    it('resolves conflicting Tailwind padding, margin, and layout classes', () => {
      // Direct property collisions
      expect(cn('p-2', 'p-4')).toBe('p-4');
      expect(cn('px-2 py-1', 'px-6')).toBe('py-1 px-6');
      expect(cn('m-1 m-2 m-4')).toBe('m-4');
      expect(cn('mt-2 mt-4')).toBe('mt-4');

      // Layout collisions
      expect(cn('flex', 'inline-flex', 'block')).toBe('block');
      expect(cn('absolute', 'relative', 'fixed')).toBe('fixed');

      // Typography collisions
      expect(cn('text-sm text-red-500', 'text-lg text-blue-500')).toBe('text-lg text-blue-500');
      expect(cn('font-normal', 'font-bold')).toBe('font-bold');

      // Background and border collisions
      expect(cn('bg-red-500', 'bg-blue-500', 'bg-transparent')).toBe('bg-transparent');
      expect(cn('rounded-sm', 'rounded-full')).toBe('rounded-full');
      expect(cn('border-2', 'border-4')).toBe('border-4');
      expect(cn('opacity-50', 'opacity-100')).toBe('opacity-100');
    });

    it('handles arbitrary Tailwind values and modifier conflicts', () => {
      expect(cn('p-[10px]', 'p-[20px]')).toBe('p-[20px]');
      expect(cn('w-[100px]', 'w-full')).toBe('w-full');
      expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500');
    });

    it('handles object key syntax correctly with truthy and falsy values', () => {
      expect(
        cn({
          'text-white': true,
          'bg-black': 1,
          'hidden': false,
          'opacity-0': 0,
          'pointer-events-none': null,
          'cursor-pointer': undefined,
        })
      ).toBe('text-white bg-black');
    });
  });

  describe('2. Badge Adversarial & Extreme Props', () => {
    it('renders all canonical and custom domain variants to static markup', () => {
      const variants = [
        'default',
        'secondary',
        'destructive',
        'outline',
        'feature',
        'improvement',
        'fix',
        'noise',
      ] as const;

      for (const variant of variants) {
        const html = renderToStaticMarkup(
          <Badge variant={variant}>Variant {variant}</Badge>
        );
        expect(html).toContain(`Variant ${variant}`);
        expect(html).toContain('inline-flex');
        expect(html).toContain('rounded-md');
      }
    });

    it('survives undefined, null, or invalid variant gracefully without throwing', () => {
      // Fallback to default variant
      const htmlUndefined = renderToStaticMarkup(
        <Badge variant={undefined}>Undefined Variant</Badge>
      );
      expect(htmlUndefined).toContain('bg-primary');

      // Invalid cast variant
      const htmlInvalid = renderToStaticMarkup(
        <Badge variant={'nonexistent' as any}>Invalid Variant</Badge>
      );
      expect(htmlInvalid).toContain('Invalid Variant');
    });

    it('supports custom className override over variant styles', () => {
      const html = renderToStaticMarkup(
        <Badge variant="feature" className="border-red-500 bg-red-500 text-white">
          Overridden
        </Badge>
      );
      expect(html).toContain('border-red-500');
      expect(html).toContain('bg-red-500');
      expect(html).toContain('text-white');
      // Previous conflicting variant classes should have been stripped by twMerge
      expect(html).not.toContain('text-emerald-600');
    });

    it('renders extreme children (empty, numeric 0, giant string, React node)', () => {
      expect(renderToStaticMarkup(<Badge>{0}</Badge>)).toContain('0');
      expect(renderToStaticMarkup(<Badge>{null}</Badge>)).toContain('<div class="inline-flex items-center rounded-md border');

      const giantText = 'A'.repeat(5000);
      const htmlGiant = renderToStaticMarkup(<Badge>{giantText}</Badge>);
      expect(htmlGiant).toContain(giantText);

      const htmlWithIcon = renderToStaticMarkup(
        <Badge>
          <span data-testid="icon">🔥</span> Hotfix
        </Badge>
      );
      expect(htmlWithIcon).toContain('data-testid="icon"');
    });

    it('propagates standard HTML and accessibility attributes', () => {
      const html = renderToStaticMarkup(
        <Badge
          id="test-badge"
          role="status"
          aria-label="Release Feature"
          data-version="1.2.3"
        >
          v1.2.3
        </Badge>
      );
      expect(html).toContain('id="test-badge"');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-label="Release Feature"');
      expect(html).toContain('data-version="1.2.3"');
    });
  });

  describe('3. Button Adversarial & Extreme Props', () => {
    it('renders all variants and sizes cleanly', () => {
      const variants = [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
      ] as const;
      const sizes = ['default', 'sm', 'lg', 'icon'] as const;

      for (const variant of variants) {
        for (const size of sizes) {
          const html = renderToStaticMarkup(
            <Button variant={variant} size={size}>
              {variant}-{size}
            </Button>
          );
          expect(html).toContain(`${variant}-${size}`);
          expect(html).toContain('<button');
        }
      }
    });

    it('delegates to child element seamlessly when asChild is true', () => {
      const html = renderToStaticMarkup(
        <Button asChild variant="outline">
          <a href="https://shiplog.dev" target="_blank" rel="noreferrer">
            External Link
          </a>
        </Button>
      );
      // Must render an anchor tag with button classes, NOT nested <button><a>
      expect(html).toContain('<a');
      expect(html).not.toContain('<button');
      expect(html).toContain('href="https://shiplog.dev"');
      expect(html).toContain('border-input');
      expect(html).toContain('External Link');
    });

    it('handles disabled state and overrides cursor/pointer styling', () => {
      const html = renderToStaticMarkup(
        <Button disabled aria-disabled="true">
          Disabled Action
        </Button>
      );
      expect(html).toContain('disabled=""');
      expect(html).toContain('disabled:pointer-events-none');
      expect(html).toContain('disabled:opacity-50');
      expect(html).toContain('aria-disabled="true"');
    });

    it('resolves conflicting className overrides on button', () => {
      const html = renderToStaticMarkup(
        <Button variant="default" size="default" className="h-12 px-10 bg-emerald-600 hover:bg-emerald-700">
          Custom Green
        </Button>
      );
      expect(html).toContain('h-12');
      expect(html).toContain('px-10');
      expect(html).toContain('bg-emerald-600');
      // h-9 and px-4 from default size should be overridden
      expect(html).not.toContain('h-9');
      expect(html).not.toContain('px-4');
    });

    it('forwards ref properly to underlying button element', () => {
      const ref = React.createRef<HTMLButtonElement>();
      const btn = React.createElement(Button, { ref, id: 'ref-btn' }, 'Click');
      expect(btn.props.ref).toBe(ref);
    });
  });

  describe('4. Input & Textarea Adversarial Props & Edge Cases', () => {
    it('Input renders diverse types, extreme placeholders, and handles disabled states', () => {
      const types = ['text', 'password', 'email', 'number', 'search', 'url'] as const;
      for (const t of types) {
        const html = renderToStaticMarkup(
          <Input type={t} placeholder={`Enter ${t}...`} />
        );
        expect(html).toContain(`type="${t}"`);
        expect(html).toContain(`placeholder="Enter ${t}..."`);
      }

      const disabledHtml = renderToStaticMarkup(
        <Input disabled required readOnly value="constant-value" />
      );
      expect(disabledHtml).toContain('disabled=""');
      expect(disabledHtml).toContain('required=""');
      expect(disabledHtml.toLowerCase()).toContain('readonly=""');
      expect(disabledHtml).toContain('value="constant-value"');
      expect(disabledHtml).toContain('disabled:cursor-not-allowed');
    });

    it('Input className override correctly replaces default heights and borders', () => {
      const html = renderToStaticMarkup(
        <Input className="h-14 border-red-500 text-lg bg-black" />
      );
      expect(html).toContain('h-14');
      expect(html).toContain('border-red-500');
      expect(html).toContain('text-lg');
      expect(html).not.toContain('h-9'); // overridden
    });

    it('Textarea renders multiline values, custom rows, and handles disabled states', () => {
      const multiline = 'Line 1\nLine 2\nLine 3 with unicode: 🚢✨';
      const html = renderToStaticMarkup(
        <Textarea rows={8} defaultValue={multiline} disabled placeholder="Release notes markdown..." />
      );
      expect(html).toContain('<textarea');
      expect(html).toContain('rows="8"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('Line 1\nLine 2\nLine 3 with unicode: 🚢✨');
    });

    it('Textarea className override handles min-height adjustments cleanly', () => {
      const html = renderToStaticMarkup(
        <Textarea className="min-h-[200px] border-2 border-primary" />
      );
      expect(html).toContain('min-h-[200px]');
      expect(html).toContain('border-primary');
      expect(html).not.toContain('min-h-[60px]'); // default overridden
    });
  });

  describe('5. Dialog & Radix Components Headless / SSR Simulation', () => {
    it('Dialog root and trigger render cleanly to static markup', () => {
      const html = renderToStaticMarkup(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Release Modal</Button>
          </DialogTrigger>
        </Dialog>
      );
      expect(html).toContain('Open Release Modal');
      expect(html).toContain('<button');
    });

    it('enforces that DialogTitle outside of Dialog throws an error', () => {
      // Radix UI context contract: DialogTitle requires Dialog context
      expect(() => {
        renderToStaticMarkup(<DialogTitle>Orphan Title</DialogTitle>);
      }).toThrow(/DialogTitle/);
    });

    it('DialogHeader, DialogFooter, DialogTitle, and DialogDescription render expected classes inside Dialog', () => {
      const html = renderToStaticMarkup(
        <Dialog open={true}>
          <DialogHeader className="custom-header">
            <DialogTitle>New Release v1.0.0</DialogTitle>
            <DialogDescription>Review synthesized AI notes before publishing.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="custom-footer">
            <Button variant="outline">Cancel</Button>
            <Button>Publish</Button>
          </DialogFooter>
        </Dialog>
      );
      expect(html).toContain('New Release v1.0.0');
      expect(html).toContain('Review synthesized AI notes before publishing.');
      expect(html).toContain('custom-header');
      expect(html).toContain('custom-footer');
      expect(html).toContain('text-lg font-semibold');
      expect(html).toContain('text-sm text-muted-foreground');
    });

    it('DialogContent wraps content inside DialogPortal without crashing during SSR', () => {
      // In server render, DialogPortal produces no inline HTML, but must not crash
      const html = renderToStaticMarkup(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Portal Title</DialogTitle>
            <DialogDescription>Portal Description</DialogDescription>
          </DialogContent>
        </Dialog>
      );
      expect(typeof html).toBe('string');
    });
  });

  describe('6. Tabs Component Stress Testing', () => {
    it('renders full tabs hierarchy cleanly', () => {
      const html = renderToStaticMarkup(
        <Tabs defaultValue="features">
          <TabsList>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="fixes">Fixes</TabsTrigger>
            <TabsTrigger value="social">Social Thread</TabsTrigger>
          </TabsList>
          <TabsContent value="features">
            <p>New AI Synthesis engine.</p>
          </TabsContent>
          <TabsContent value="fixes">
            <p>Fixed webhook timeout bug.</p>
          </TabsContent>
          <TabsContent value="social">
            <p>Twitter post draft.</p>
          </TabsContent>
        </Tabs>
      );

      expect(html).toContain('Features');
      expect(html).toContain('Fixes');
      expect(html).toContain('Social Thread');
      expect(html).toContain('New AI Synthesis engine.');
    });

    it('handles disabled tabs trigger', () => {
      const html = renderToStaticMarkup(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Enabled Tab</TabsTrigger>
            <TabsTrigger value="tab2" disabled>
              Disabled Tab
            </TabsTrigger>
          </TabsList>
        </Tabs>
      );
      expect(html).toContain('disabled=""');
      expect(html).toContain('disabled:pointer-events-none');
    });

    it('TabsList and TabsTrigger apply custom class overrides cleanly', () => {
      const html = renderToStaticMarkup(
        <Tabs defaultValue="tab1">
          <TabsList className="bg-red-500 h-12">
            <TabsTrigger value="tab1" className="text-white font-bold">
              Tab 1
            </TabsTrigger>
          </TabsList>
        </Tabs>
      );
      expect(html).toContain('bg-red-500');
      expect(html).toContain('h-12');
      expect(html).toContain('text-white');
      expect(html).toContain('font-bold');
    });
  });

  describe('7. Card, Separator, Tooltip, and Toast Primitives', () => {
    it('Card composability and hierarchy renders completely and twMerge resolves border classes', () => {
      const html = renderToStaticMarkup(
        <Card className="max-w-md shadow-lg border-2">
          <CardHeader>
            <CardTitle>ShipLog Pro</CardTitle>
            <CardDescription>$15 / month subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Unlimited repositories and automated releases.</p>
          </CardContent>
          <CardFooter>
            <Button>Upgrade Now</Button>
          </CardFooter>
        </Card>
      );

      expect(html).toContain('ShipLog Pro');
      expect(html).toContain('$15 / month subscription');
      expect(html).toContain('Unlimited repositories and automated releases.');
      expect(html).toContain('Upgrade Now');
      // twMerge replaced default 'border' with 'border-2'
      expect(html).toContain('border-2');
      expect(html).toContain('rounded-xl bg-card text-card-foreground');
    });

    it('Separator renders both horizontal and vertical orientations', () => {
      const horizontalHtml = renderToStaticMarkup(<Separator orientation="horizontal" />);
      expect(horizontalHtml).toContain('h-[1px] w-full');

      const verticalHtml = renderToStaticMarkup(<Separator orientation="vertical" />);
      expect(verticalHtml).toContain('h-full w-[1px]');
    });

    it('Tooltip renders trigger without throwing during SSR', () => {
      expect(() => {
        renderToStaticMarkup(
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Hover info</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tooltip helpful text</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }).not.toThrow();
    });

    it('Toast renders default, destructive, and success variant styles inside ToastProvider', () => {
      // In SSR / static render, ToastProvider renders without throwing
      expect(() => {
        renderToStaticMarkup(
          <ToastProvider>
            <Toast variant="default">
              <ToastTitle>Default</ToastTitle>
            </Toast>
            <Toast variant="destructive">
              <ToastTitle>Destructive</ToastTitle>
            </Toast>
            <Toast variant="success">
              <ToastTitle>Success</ToastTitle>
            </Toast>
            <ToastViewport />
          </ToastProvider>
        );
      }).not.toThrow();
    });

    it('useToast state reducer handles ADD_TOAST, UPDATE_TOAST, DISMISS_TOAST, and REMOVE_TOAST correctly', () => {
      const initialState = { toasts: [] };

      // 1. ADD_TOAST
      const toastItem = {
        id: 'toast-1',
        title: 'Release Published',
        description: 'v1.0.0 is live',
        open: true,
      };
      const state1 = reducer(initialState, { type: 'ADD_TOAST', toast: toastItem });
      expect(state1.toasts).toHaveLength(1);
      expect(state1.toasts[0].id).toBe('toast-1');

      // 2. UPDATE_TOAST
      const state2 = reducer(state1, {
        type: 'UPDATE_TOAST',
        toast: { id: 'toast-1', description: 'Updated description' },
      });
      expect(state2.toasts[0].description).toBe('Updated description');

      // 3. DISMISS_TOAST
      const state3 = reducer(state2, { type: 'DISMISS_TOAST', toastId: 'toast-1' });
      expect(state3.toasts[0].open).toBe(false);

      // 4. REMOVE_TOAST
      const state4 = reducer(state3, { type: 'REMOVE_TOAST', toastId: 'toast-1' });
      expect(state4.toasts).toHaveLength(0);
    });
  });

  describe('8. Date & String Utilities Stress Tests', () => {
    it('formatDate handles valid ISO dates, Date objects, and invalid strings safely', () => {
      // Valid ISO
      expect(formatDate('2026-09-22T10:00:00Z')).toMatch(/Sep.*22.*2026/);
      // Valid Date instance
      expect(formatDate(new Date('2026-01-15T00:00:00Z'))).toMatch(/Jan.*15.*2026/);
      // Invalid date string returns original string without throwing
      expect(formatDate('invalid-date-string')).toBe('invalid-date-string');
      expect(formatDate('')).toBe('');
    });

    it('truncate handles boundaries: empty string, exact length, length + 1, negative, and large strings', () => {
      expect(truncate('', 10)).toBe('');
      expect(truncate('Hello', 5)).toBe('Hello');
      expect(truncate('Hello World', 5)).toBe('Hello...');
      expect(truncate('A', 0)).toBe('...');
      const longStr = 'x'.repeat(1000);
      expect(truncate(longStr, 100)).toBe(`${'x'.repeat(100)}...`);
    });
  });

  describe('9. Production SSR HomePage Render Simulation', () => {
    it('HomePage server component renders to static markup without hydration errors or missing assets', async () => {
      (globalThis as any).React = React;
      const { default: HomePage } = await import('@/app/page');
      const html = renderToStaticMarkup(<HomePage />);
      expect(html).toContain('ShipLog');
      expect(html).toContain('From Merged Pull Requests to');
      expect(html).toContain('Viral Releases');
      expect(html).toContain('Noise Filter');
      expect(html).toContain('Gemini 1.5');
      expect(html).toContain('Embeddable Widget');
      expect(html).toContain('SSR Portal');
      expect(html).toContain('href="/c/demo"');
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('href="/billing"');
    });
  });

  describe('10. Component Export Integrity, toastVariants & Toaster Stress Tests', () => {
    it('toastVariants returns expected Tailwind classes for all variant configurations', () => {
      // Default variant
      const defaultClasses = toastVariants();
      expect(defaultClasses).toContain('group pointer-events-auto');
      expect(defaultClasses).toContain('border bg-background text-foreground');

      // Explicit default
      const explicitDefault = toastVariants({ variant: 'default' });
      expect(explicitDefault).toBe(defaultClasses);

      // Destructive variant
      const destructiveClasses = toastVariants({ variant: 'destructive' });
      expect(destructiveClasses).toContain('destructive group border-destructive bg-destructive text-destructive-foreground');

      // Success variant
      const successClasses = toastVariants({ variant: 'success' });
      expect(successClasses).toContain('border-emerald-500/20 bg-emerald-50 text-emerald-900');

      // Undefined variant falls back to default
      const undefinedVariantClasses = toastVariants({ variant: undefined });
      expect(undefinedVariantClasses).toContain('border bg-background text-foreground');

      // Custom className merging via cva
      const customClasses = toastVariants({ className: 'custom-toast-shadow' });
      expect(customClasses).toContain('custom-toast-shadow');

      // Conflict resolution via cn()
      const mergedClasses = cn(toastVariants(), 'p-8');
      expect(mergedClasses).toContain('p-8');
      expect(mergedClasses).not.toContain('p-4 pr-6');
    });

    it('Toaster component renders without crashing during SSR and client contexts', () => {
      expect(() => {
        const html = renderToStaticMarkup(<Toaster />);
        expect(typeof html).toBe('string');
      }).not.toThrow();
    });

    it('all component exports across all 12 UI modules are defined and importable without runtime errors', async () => {
      const buttonMod = await import('@/components/ui/button');
      expect(buttonMod.Button).toBeDefined();
      expect(buttonMod.buttonVariants).toBeDefined();
      expect(typeof buttonMod.buttonVariants).toBe('function');

      const badgeMod = await import('@/components/ui/badge');
      expect(badgeMod.Badge).toBeDefined();
      expect(badgeMod.badgeVariants).toBeDefined();
      expect(typeof badgeMod.badgeVariants).toBe('function');

      const cardMod = await import('@/components/ui/card');
      expect(cardMod.Card).toBeDefined();
      expect(cardMod.CardHeader).toBeDefined();
      expect(cardMod.CardTitle).toBeDefined();
      expect(cardMod.CardDescription).toBeDefined();
      expect(cardMod.CardContent).toBeDefined();
      expect(cardMod.CardFooter).toBeDefined();

      const dialogMod = await import('@/components/ui/dialog');
      expect(dialogMod.Dialog).toBeDefined();
      expect(dialogMod.DialogPortal).toBeDefined();
      expect(dialogMod.DialogOverlay).toBeDefined();
      expect(dialogMod.DialogTrigger).toBeDefined();
      expect(dialogMod.DialogClose).toBeDefined();
      expect(dialogMod.DialogContent).toBeDefined();
      expect(dialogMod.DialogHeader).toBeDefined();
      expect(dialogMod.DialogFooter).toBeDefined();
      expect(dialogMod.DialogTitle).toBeDefined();
      expect(dialogMod.DialogDescription).toBeDefined();

      const inputMod = await import('@/components/ui/input');
      expect(inputMod.Input).toBeDefined();

      const separatorMod = await import('@/components/ui/separator');
      expect(separatorMod.Separator).toBeDefined();

      const tabsMod = await import('@/components/ui/tabs');
      expect(tabsMod.Tabs).toBeDefined();
      expect(tabsMod.TabsList).toBeDefined();
      expect(tabsMod.TabsTrigger).toBeDefined();
      expect(tabsMod.TabsContent).toBeDefined();

      const textareaMod = await import('@/components/ui/textarea');
      expect(textareaMod.Textarea).toBeDefined();

      const toastMod = await import('@/components/ui/toast');
      expect(toastMod.Toast).toBeDefined();
      expect(toastMod.ToastAction).toBeDefined();
      expect(toastMod.ToastClose).toBeDefined();
      expect(toastMod.ToastDescription).toBeDefined();
      expect(toastMod.ToastProvider).toBeDefined();
      expect(toastMod.ToastTitle).toBeDefined();
      expect(toastMod.ToastViewport).toBeDefined();
      expect(toastMod.toastVariants).toBeDefined();
      expect(typeof toastMod.toastVariants).toBe('function');

      const toasterMod = await import('@/components/ui/toaster');
      expect(toasterMod.Toaster).toBeDefined();
      expect(typeof toasterMod.Toaster).toBe('function');

      const tooltipMod = await import('@/components/ui/tooltip');
      expect(tooltipMod.Tooltip).toBeDefined();
      expect(tooltipMod.TooltipContent).toBeDefined();
      expect(tooltipMod.TooltipProvider).toBeDefined();
      expect(tooltipMod.TooltipTrigger).toBeDefined();

      const useToastMod = await import('@/components/ui/use-toast');
      expect(useToastMod.useToast).toBeDefined();
      expect(useToastMod.toast).toBeDefined();
      expect(useToastMod.reducer).toBeDefined();
    });

    it('renders Toast subcomponents (Title, Description, Action, Close) and Toast root safely in SSR', () => {
      // Subcomponents render static HTML directly
      const titleHtml = renderToStaticMarkup(<ToastTitle className="custom-title">New Release</ToastTitle>);
      expect(titleHtml).toContain('New Release');
      expect(titleHtml).toContain('text-sm font-semibold');
      expect(titleHtml).toContain('custom-title');

      const descHtml = renderToStaticMarkup(<ToastDescription className="custom-desc">v1.0.0 synthesized</ToastDescription>);
      expect(descHtml).toContain('v1.0.0 synthesized');
      expect(descHtml).toContain('text-sm opacity-90');
      expect(descHtml).toContain('custom-desc');

      const actionHtml = renderToStaticMarkup(<ToastAction altText="undo">Undo</ToastAction>);
      expect(actionHtml).toContain('Undo');
      expect(actionHtml).toContain('data-radix-toast-announce-alt="undo"');
      expect(actionHtml).toContain('inline-flex');

      const closeHtml = renderToStaticMarkup(<ToastClose />);
      expect(closeHtml).toContain('toast-close=""');
      expect(closeHtml).toContain('lucide-x');

      // Toast root with provider and viewport safely renders without error during SSR
      expect(() => {
        renderToStaticMarkup(
          <ToastProvider>
            <Toast variant="default" className="test-default">
              <ToastTitle>Default</ToastTitle>
              <ToastDescription>Description</ToastDescription>
              <ToastAction altText="action">Action</ToastAction>
              <ToastClose />
            </Toast>
            <Toast variant="destructive" className="test-destructive">
              <ToastTitle>Destructive</ToastTitle>
            </Toast>
            <Toast variant="success" className="test-success">
              <ToastTitle>Success</ToastTitle>
            </Toast>
            <ToastViewport />
          </ToastProvider>
        );
      }).not.toThrow();
    });
  });
});

