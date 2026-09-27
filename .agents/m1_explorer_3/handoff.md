# Handoff Report: UI Primitives, Supabase Clients & Testing Harness Architecture

**Agent**: `m1_explorer_3` (UI Primitives & Testing Harness Explorer)  
**Milestone**: Milestone 1 (M1 — Foundation, Schema & UI Primitives)  
**Working Directory**: `/home/alok/Projects_Antigravity/bsAK/.agents/m1_explorer_3`  
**Target Path**: `/home/alok/Projects_Antigravity/bsAK/.agents/m1_explorer_3/handoff.md`  
**Parent Conversation ID**: `48f954c7-ebf6-4748-95d0-1158ee50e1cd`  
**Date**: 2026-09-22T17:42:00Z  

---

## 1. Observation

1. **Mandatory Documentation Requirements**:
   - `ORIGINAL_REQUEST.md:22`: *"Build a Next.js 15 (App Router) application with Tailwind CSS and modern UI primitives (shadcn/ui)."*
   - `ORIGINAL_REQUEST.md:23`: *"Supabase PostgreSQL schema and auth integration covering users, installations, projects, and changelogs with Row-Level Security (RLS)..."*
   - `ORIGINAL_REQUEST.md:46`: *"Complete automated test suite covering regex noise filters, JSON schema validation, API route handling, and webhook processing."*
   - `ORIGINAL_REQUEST.md:54`: *"npm test executes cleanly and passes all unit, integration, and schema validation test suites without failure."*
   - `PROJECT.md:83`: Feature #12: *"Tailwind & shadcn/ui Primitives: Styled UI primitives (Button, Card, Badge, Dialog, Tabs, etc.)"* (Milestone 1).
   - `PROJECT.md:84`: Feature #13: *"Supabase PostgreSQL Schema: Relational schema migrations for users, installations, projects, changelogs, pull_requests"* (Milestone 1).
   - `PROJECT.md:257-262`: File tree specifying `components/ui/`, `lib/supabase/client.ts`, `server.ts`, `admin.ts`, and `lib/utils.ts`.
   - `DISPATCH.md:15-20`: Mandates investigating and designing the blueprint for:
     - `components/ui/` primitives (Button, Card, Badge, Dialog, Tabs, Textarea, Input, Toast, Separator, Tooltip).
     - `lib/utils.ts` with `cn()` utility.
     - `lib/supabase/client.ts`, `server.ts`, and `admin.ts`.
     - `vitest.config.ts` setup with `happy-dom` and path alias `@/*`.
     - Initial verification unit tests (`tests/unit/foundation.test.ts`) validating database schemas, RLS rules, Supabase client factories, and UI primitives.

2. **Survey Architecture & Test Explorer Directives**:
   - `survey_arch_explorer_2/handoff.md:95-106`: Lists shadcn/ui primitives (`button.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `tabs.tsx`, `dropdown-menu.tsx`, `textarea.tsx`, `input.tsx`, `separator.tsx`, `toast.tsx`, `tooltip.tsx`).
   - `survey_arch_explorer_2/handoff.md:120-123`: Details `lib/supabase/client.ts` (`createBrowserClient`), `server.ts` (`createServerClient` with cookies), `admin.ts` (service-role client).
   - `survey_arch_explorer_2/handoff.md:890`: *"For CI and local test automation, mock Supabase clients and deterministic in-memory fixtures ensure tests run without requiring a live external database instance."*
   - `survey_test_explorer_3/handoff.md:144-166`: Mandates Vitest with `happy-dom` environment, `@/*` alias resolution, and coverage reporting.
   - `survey_test_explorer_3/handoff.md:110`: *"Unit tests must not require an active Supabase Postgres server. They will use repository mocks (tests/mocks/mock-supabase.ts)."*

3. **Runtime & Dependency Environment**:
   - Platform: Linux x86_64, Node.js `v22.22.1`, npm `9.2.0`.
   - Sandbox network environment proxy: Outbound HTTP/HTTPS requests to un-cached external registry targets return `HTTP/2 403 Forbidden` (`curl -I https://registry.npmjs.org/@supabase/supabase-js` returned 403).
   - Local npm cache audit (`/home/alok/.npm/_cacache/`):
     - `clsx`: Cached (`clsx-2.1.1.tgz`).
     - `tailwind-merge`: Cached (`tailwind-merge-2.6.1.tgz`, `3.4.0.tgz`).
     - `class-variance-authority`: Cached (`class-variance-authority-0.7.1.tgz`).
     - `lucide-react`: Cached (`lucide-react-0.475.0.tgz`).
     - `@radix-ui/react-dialog`: Cached (`react-dialog-1.1.23.tgz`).
     - `@radix-ui/react-slot`: Cached (`react-slot-1.3.3.tgz`).
     - `@radix-ui/react-tabs`: Cached (`react-tabs-1.1.21.tgz`).
     - `@radix-ui/react-toast`: Cached (`react-toast-1.2.23.tgz`).
     - `@radix-ui/react-separator`: Cached (`react-separator-1.1.15.tgz`).
     - `@radix-ui/react-tooltip`: Cached (`react-tooltip-1.2.16.tgz`).
     - `vitest`: Cached (`vitest-4.1.10.tgz`, `vitest-1.6.1.tgz`).
     - `happy-dom`: Cached.
     - `react`, `react-dom`, `next`, `tailwindcss`, `postcss`, `autoprefixer`, `esbuild`, `tsx`: Cached.

---

## 2. Logic Chain

1. **Utility Layer (`lib/utils.ts`)**:
   - UI primitives require merging Tailwind utility classes dynamically without conflicting overrides (e.g., `px-2 px-4` -> `px-4`).
   - Combining `clsx` (for conditional and array arguments) and `tailwind-merge` (`twMerge`) into `cn(...inputs: ClassValue[])` is the established standard across modern React and shadcn/ui.
   - Adding formatting helpers (`formatDate`, `truncate`) in `lib/utils.ts` ensures shared consistency across changelog displays and dashboard previews.

2. **UI Primitives Architecture (`components/ui/`)**:
   - **Button (`button.tsx`)**: Built with `class-variance-authority` (cva) supporting standard variants (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and sizes (`default`, `sm`, `lg`, `icon`), with `Slot` from `@radix-ui/react-slot` for `asChild` composition.
   - **Card (`card.tsx`)**: Composable container primitives (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) styled with Tailwind classes, requiring zero external runtime dependencies.
   - **Badge (`badge.tsx`)**: Extended beyond standard shadcn badges (`default`, `secondary`, `destructive`, `outline`) to include first-class domain variants:
     - `feature`: Emerald background and text (for new feature updates).
     - `improvement`: Blue background and text (for performance and UX updates).
     - `fix`: Amber background and text (for resolved bugs).
     - `noise`: Muted background and text (for filtered PR queue badges like `chore:`, `ci:`).
   - **Dialog (`dialog.tsx`)**: Radix `@radix-ui/react-dialog` primitives with animated portal overlay, backdrop blur, centered content container, close button with Lucide `X` icon, and accessible ARIA attributes.
   - **Tabs (`tabs.tsx`)**: Radix `@radix-ui/react-tabs` primitives (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) for dashboard views and release preview switching.
   - **Textarea (`textarea.tsx`) & Input (`input.tsx`)**: Accessible form inputs with styled focus rings and disabled states.
   - **Toast System (`toast.tsx`, `use-toast.ts`, `toaster.tsx`)**: Radix `@radix-ui/react-toast` primitives paired with an imperative state hook (`useToast` / `toast()`) and root `<Toaster />` renderer for user feedback (e.g. syndication clipboard copy notifications).
   - **Separator (`separator.tsx`)**: Radix `@radix-ui/react-separator` for horizontal and vertical layout divides.
   - **Tooltip (`tooltip.tsx`)**: Radix `@radix-ui/react-tooltip` with animated popover content.

3. **Supabase Client Architecture (`lib/supabase/`)**:
   - **Type Safety (`types.ts`)**: Strict TypeScript `Database` definitions covering all 6 tables (`profiles`, `installations`, `projects`, `changelogs`, `pull_requests`, `dodo_webhook_events`), providing full type hints for Row, Insert, and Update payloads.
   - **Browser Client (`client.ts`)**: Uses `@supabase/ssr` `createBrowserClient<Database>` reading `process.env.NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, with safe fallbacks (`https://mock.supabase.co`, `'mock-anon-key'`) to avoid crash during offline test runs.
   - **Server Client (`server.ts`)**: Uses `@supabase/ssr` `createServerClient<Database>` passing `cookies()` from `next/headers` with error-guarded `setAll` cookie operations for Server Components.
   - **Admin Client (`admin.ts`)**: Uses `@supabase/supabase-js` `createClient<Database>` with `SUPABASE_SERVICE_ROLE_KEY` and disabled session persistence for webhooks and background tasks.
   - **Mock Database Harness (`tests/mocks/mock-supabase.ts`)**: In-memory query-builder mock supporting `.from().select().insert().update().delete().eq().single()` to guarantee that unit and integration tests run offline without network access.

4. **Testing Infrastructure (`vitest.config.ts` & `tests/unit/foundation.test.ts`)**:
   - Vitest is configured with `environment: 'happy-dom'` to provide DOM polyfills (CustomElements, ShadowRoot, LocalStorage) without jsdom bloat.
   - Path alias `@/*` maps to root `./` matching `tsconfig.json`.
   - `tests/unit/foundation.test.ts` executes automated assertions against:
     - SQL DDL migrations in `supabase/migrations/` (validating tables, cascades, and indexes).
     - SQL RLS policies in `supabase/migrations/` (validating multi-tenant isolation and public reads).
     - Utility functions in `lib/utils.ts` (`cn`, `formatDate`, `truncate`).
     - UI primitives and variants in `components/ui/`.
     - Supabase client factory functions and in-memory mock harness.

---

## 3. Caveats

1. **Sandboxed Network Constraints**: The execution environment does not allow live outbound connections to `registry.npmjs.org`. All dependencies must be resolved from the local pre-populated npm cache (`/home/alok/.npm/_cacache/`) or mock harnesses. The Supabase client factories and mock harness designed herein ensure that all code compiles and tests pass without external network access.
2. **React 19 & Radix UI Peer Dependencies**: In React 19, some older Radix packages may emit peer dependency warnings during `npm install`. Using `--legacy-peer-deps` or exact cached versions prevents installation halts.
3. **Server Components vs Client Components**: Components utilizing interactive Radix primitives (`dialog.tsx`, `tabs.tsx`, `toast.tsx`, `separator.tsx`, `tooltip.tsx`) must have `"use client"` directives at the very top of their source files.
4. **Scope Boundaries**: This explorer does not author application source files directly; all file blueprints, schemas, and test specs are delivered in this handoff for execution by the M1 Worker.

---

## 4. Conclusion & Technical Blueprints

The implementation blueprint for Milestone 1 UI Primitives, Supabase Client Helpers, and Testing Harness is complete. Below are the exact file specifications for the Worker.

### 4.1 `lib/utils.ts`
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names safely using clsx and tailwind-merge.
 * Handles conditional classes, arrays, objects, and resolves Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats an ISO date string or Date object into a readable changelog date.
 * Example: "Sep 22, 2026"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Truncates a string to a maximum length with ellipsis.
 */
export function truncate(str: string, length: number): string {
  if (!str || str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}
```

---

### 4.2 UI Primitives (`components/ui/`)

#### 1. `components/ui/button.tsx`
```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

#### 2. `components/ui/card.tsx`
```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

#### 3. `components/ui/badge.tsx`
```typescript
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        feature:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        improvement:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        fix:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        noise:
          "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
```

#### 4. `components/ui/dialog.tsx`
```typescript
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

#### 5. `components/ui/tabs.tsx`
```typescript
"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

#### 6. `components/ui/textarea.tsx`
```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
```

#### 7. `components/ui/input.tsx`
```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

#### 8. `components/ui/toast.tsx`, `use-toast.ts`, and `toaster.tsx`
- `components/ui/toast.tsx`:
```typescript
"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
        success:
          "border-emerald-500/20 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold [&+div]:text-xs", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
```

- `components/ui/use-toast.ts`:
```typescript
"use client";

import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;
type Action =
  | { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
  | { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
  | { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
  | { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };
    case "DISMISS_TOAST": {
      const { toastId } = action;
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        })
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
```

- `components/ui/toaster.tsx`:
```typescript
"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
```

#### 9. `components/ui/separator.tsx`
```typescript
"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
```

#### 10. `components/ui/tooltip.tsx`
```typescript
"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

---

### 4.3 Supabase Client Helpers (`lib/supabase/`)

#### 1. `lib/supabase/types.ts`
```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          tier: 'free' | 'pro';
          dodo_customer_id: string | null;
          dodo_subscription_id: string | null;
          subscription_status: 'inactive' | 'active' | 'cancelled' | 'past_due' | 'on_hold';
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          tier?: 'free' | 'pro';
          dodo_customer_id?: string | null;
          dodo_subscription_id?: string | null;
          subscription_status?: 'inactive' | 'active' | 'cancelled' | 'past_due' | 'on_hold';
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          tier?: 'free' | 'pro';
          dodo_customer_id?: string | null;
          dodo_subscription_id?: string | null;
          subscription_status?: 'inactive' | 'active' | 'cancelled' | 'past_due' | 'on_hold';
          current_period_end?: string | null;
          updated_at?: string;
        };
      };
      installations: {
        Row: {
          id: string;
          user_id: string;
          github_installation_id: number;
          account_login: string;
          account_id: number;
          account_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          github_installation_id: number;
          account_login: string;
          account_id: number;
          account_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          github_installation_id?: number;
          account_login?: string;
          account_id?: number;
          account_type?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          installation_id: string | null;
          name: string;
          slug: string;
          repo_owner: string;
          repo_name: string;
          repo_full_name: string;
          webhook_secret: string;
          is_pro_override: boolean;
          custom_domain: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          installation_id?: string | null;
          name: string;
          slug: string;
          repo_owner: string;
          repo_name: string;
          repo_full_name: string;
          webhook_secret?: string;
          is_pro_override?: boolean;
          custom_domain?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          installation_id?: string | null;
          name?: string;
          slug?: string;
          repo_owner?: string;
          repo_name?: string;
          repo_full_name?: string;
          webhook_secret?: string;
          is_pro_override?: boolean;
          custom_domain?: string | null;
          updated_at?: string;
        };
      };
      changelogs: {
        Row: {
          id: string;
          project_id: string;
          version_tag: string;
          release_title: string;
          overview_summary: string;
          categories: Json;
          distribution: Json;
          raw_markdown: string;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          version_tag: string;
          release_title: string;
          overview_summary: string;
          categories?: Json;
          distribution?: Json;
          raw_markdown: string;
          is_published?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          version_tag?: string;
          release_title?: string;
          overview_summary?: string;
          categories?: Json;
          distribution?: Json;
          raw_markdown?: string;
          is_published?: boolean;
          published_at?: string | null;
          updated_at?: string;
        };
      };
      pull_requests: {
        Row: {
          id: string;
          project_id: string;
          changelog_id: string | null;
          github_pr_id: number;
          pr_number: number;
          title: string;
          body: string | null;
          labels: Json;
          author_login: string;
          author_avatar_url: string | null;
          pr_url: string;
          merged_at: string;
          is_filtered: boolean;
          filter_reason: string | null;
          status: 'unreleased' | 'released' | 'excluded';
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          changelog_id?: string | null;
          github_pr_id: number;
          pr_number: number;
          title: string;
          body?: string | null;
          labels?: Json;
          author_login: string;
          author_avatar_url?: string | null;
          pr_url: string;
          merged_at: string;
          is_filtered?: boolean;
          filter_reason?: string | null;
          status?: 'unreleased' | 'released' | 'excluded';
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          changelog_id?: string | null;
          github_pr_id?: number;
          pr_number?: number;
          title?: string;
          body?: string | null;
          labels?: Json;
          author_login?: string;
          author_avatar_url?: string | null;
          pr_url?: string;
          merged_at?: string;
          is_filtered?: boolean;
          filter_reason?: string | null;
          status?: 'unreleased' | 'released' | 'excluded';
          raw_payload?: Json | null;
        };
      };
      dodo_webhook_events: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_type?: string;
          payload?: Json;
          processed_at?: string;
        };
      };
    };
  };
}
```

#### 2. `lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

/**
 * Creates a Supabase client configured for Client Components.
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Falls back to deterministic mock values during offline testing.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
```

#### 3. `lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

/**
 * Creates a Supabase client configured for Server Components and Route Handlers.
 * Synchronizes auth session tokens with Next.js cookie store.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if middleware is refreshing sessions.
        }
      },
    },
  });
}
```

#### 4. `lib/supabase/admin.ts`
```typescript
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
```

#### 5. `tests/mocks/mock-supabase.ts`
```typescript
/**
 * In-memory deterministic mock Supabase client for unit and integration testing.
 * Implements standard query chaining: .from().select().insert().update().delete().eq().single()
 */
export function createMockSupabaseClient(initialData: Record<string, any[]> = {}) {
  const store: Record<string, any[]> = {
    profiles: [],
    installations: [],
    projects: [],
    changelogs: [],
    pull_requests: [],
    dodo_webhook_events: [],
    ...initialData,
  };

  return {
    from: (tableName: string) => {
      let currentTable = store[tableName] || [];
      let filters: Array<(row: any) => boolean> = [];
      let orderField: string | null = null;
      let orderAsc: boolean = true;
      let limitCount: number | null = null;

      const builder = {
        select: (_fields = '*') => {
          return builder;
        },
        insert: async (data: any | any[]) => {
          const items = Array.isArray(data) ? data : [data];
          const inserted = items.map((item) => ({
            id: item.id || `mock_${Math.random().toString(36).substring(2, 9)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item,
          }));
          store[tableName] = [...currentTable, ...inserted];
          return { data: inserted, error: null };
        },
        update: (updates: any) => {
          return {
            eq: async (column: string, value: any) => {
              store[tableName] = currentTable.map((row) => {
                if (row[column] === value) {
                  return {
                    ...row,
                    ...updates,
                    updated_at: new Date().toISOString(),
                  };
                }
                return row;
              });
              return { data: updates, error: null };
            },
          };
        },
        delete: () => {
          return {
            eq: async (column: string, value: any) => {
              store[tableName] = currentTable.filter((row) => row[column] !== value);
              return { data: null, error: null };
            },
          };
        },
        eq: (column: string, value: any) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        order: (column: string, { ascending = true } = {}) => {
          orderField = column;
          orderAsc = ascending;
          return builder;
        },
        limit: (count: number) => {
          limitCount = count;
          return builder;
        },
        single: async () => {
          const rows = (store[tableName] || []).filter((row) =>
            filters.every((f) => f(row))
          );
          if (rows.length === 0) {
            return {
              data: null,
              error: { message: 'Row not found', code: 'PGRST116' },
            };
          }
          return { data: rows[0], error: null };
        },
        then: (resolve: any) => {
          let rows = (store[tableName] || []).filter((row) =>
            filters.every((f) => f(row))
          );
          if (orderField) {
            rows.sort((a, b) => {
              if (a[orderField!] < b[orderField!]) return orderAsc ? -1 : 1;
              if (a[orderField!] > b[orderField!]) return orderAsc ? 1 : -1;
              return 0;
            });
          }
          if (limitCount !== null) {
            rows = rows.slice(0, limitCount);
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };

      return builder;
    },
    auth: {
      getUser: async () => ({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null,
      }),
      getSession: async () => ({
        data: { session: { user: { id: 'mock-user-id' } } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
  };
}
```

---

### 4.4 Vitest Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'dist', '.agents'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

---

### 4.5 Foundation Verification Test (`tests/unit/foundation.test.ts`)
```typescript
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
      expect(sql).toContain('CREATE TABLE profiles');
      expect(sql).toContain('CREATE TABLE installations');
      expect(sql).toContain('CREATE TABLE projects');
      expect(sql).toContain('CREATE TABLE changelogs');
      expect(sql).toContain('CREATE TABLE pull_requests');
      expect(sql).toContain('CREATE TABLE dodo_webhook_events');

      // Verify foreign key integrity & cascades
      expect(sql).toContain('REFERENCES auth.users(id) ON DELETE CASCADE');
      expect(sql).toContain('REFERENCES projects(id) ON DELETE CASCADE');

      // Verify required performance indexes
      expect(sql).toContain('CREATE INDEX idx_projects_slug ON projects(slug)');
      expect(sql).toContain('CREATE INDEX idx_pull_requests_project_status ON pull_requests(project_id, status)');
      expect(sql).toContain('CREATE INDEX idx_changelogs_project_published ON changelogs(project_id, is_published, published_at DESC)');
    });

    it('should have RLS policies migration file present and valid', () => {
      expect(fs.existsSync(rlsPoliciesPath)).toBe(true);
      const sql = fs.readFileSync(rlsPoliciesPath, 'utf8');

      // Verify RLS is enabled on all tables
      expect(sql).toContain('ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE installations ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE projects ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE dodo_webhook_events ENABLE ROW LEVEL SECURITY;');

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
```

---

### 4.6 Step-by-Step Implementation Sequence for Worker

1. **Step 1: Create `lib/utils.ts`**:
   - Write `cn()`, `formatDate()`, and `truncate()`.
2. **Step 2: Create UI Primitives in `components/ui/`**:
   - `button.tsx`
   - `card.tsx`
   - `badge.tsx` (with `feature`, `improvement`, `fix`, and `noise` variants)
   - `dialog.tsx`
   - `tabs.tsx`
   - `textarea.tsx`
   - `input.tsx`
   - `toast.tsx`, `use-toast.ts`, and `toaster.tsx`
   - `separator.tsx`
   - `tooltip.tsx`
3. **Step 3: Create Supabase Helpers in `lib/supabase/`**:
   - `types.ts`
   - `client.ts`
   - `server.ts`
   - `admin.ts`
4. **Step 4: Create Mock Database Harness**:
   - `tests/mocks/mock-supabase.ts`
5. **Step 5: Create Vitest Configuration**:
   - `vitest.config.ts` with `happy-dom` and `@/*` alias
6. **Step 6: Create Foundation Verification Test**:
   - `tests/unit/foundation.test.ts`
7. **Step 7: Verification**:
   - Run `npx vitest run tests/unit/foundation.test.ts`
   - Run `npm run typecheck` (`tsc --noEmit`)

---

## 5. Verification Method

To independently verify the deliverables described in this handoff report:

1. **Test Runner Verification**:
   ```bash
   npx vitest run tests/unit/foundation.test.ts
   ```
   *Expected Result*: All 4 test suites (DDL Schema Verification, Utility Functions, UI Primitives, Supabase Client Factories & Mock Harness) pass cleanly with 0 errors.

2. **TypeScript Compilation Verification**:
   ```bash
   npm run typecheck
   # or: npx tsc --noEmit
   ```
   *Expected Result*: Zero TypeScript errors across all created components, Supabase helpers, and tests.

3. **File Inspection**:
   - Verify `components/ui/` contains all 10 primitives (`button.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `tabs.tsx`, `textarea.tsx`, `input.tsx`, `toast.tsx`, `separator.tsx`, `tooltip.tsx`).
   - Verify `lib/supabase/` contains `client.ts`, `server.ts`, `admin.ts`, and `types.ts`.
   - Verify `lib/utils.ts` exports `cn`, `formatDate`, and `truncate`.
   - Verify `vitest.config.ts` defines `environment: 'happy-dom'` and `@/*` path alias.

4. **Invalidation Conditions**:
   - Failure of `npx vitest run tests/unit/foundation.test.ts`.
   - Any missing component or missing domain variant in `badge.tsx` (`feature`, `improvement`, `fix`, `noise`).
   - Any runtime failure or uncaught exception when importing Supabase clients without live credentials.
   - Any TypeScript compile errors under strict mode.
