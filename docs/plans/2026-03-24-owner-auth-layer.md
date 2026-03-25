# Owner Auth Layer: GitHub OAuth + Session Detection

**Date**: 2026-03-24
**Scope**: NextAuth.js v5 setup, GitHub OAuth, owner session detection across all route groups
**Prerequisite for**: Inline Tiptap editing on public pages (separate spec)
**Plugin**: Opus (touches root layout, multiple route groups, new API route)

---

## Overview

This spec adds a lightweight authentication layer so the site can distinguish
between Travis (the owner) and everyone else. No visible UI changes for
visitors. The only user-facing addition is a `/api/auth/*` route and a
subtle sign-in mechanism.

The auth layer is the foundation for inline editing: once pages know
whether the viewer is the owner, they can conditionally render editable
surfaces. That conditional rendering is covered in a separate spec.

---

## Batch 1: NextAuth.js Installation and Configuration

### 1a. Install dependency

```bash
npm install next-auth@beta
```

### 1b. Create `auth.ts` (root of repo)

NextAuth v5 exports `auth`, `handlers`, `signIn`, and `signOut` from a
single config file. The GitHub provider auto-infers `AUTH_GITHUB_ID` and
`AUTH_GITHUB_SECRET` from environment variables.

```typescript
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

// Only allow Travis's GitHub account to authenticate.
// All other GitHub users are rejected at sign-in.
const ALLOWED_GITHUB_USERNAME = 'Travis-Gilbert';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async signIn({ profile }) {
      // Restrict access to the site owner's GitHub account
      return profile?.login === ALLOWED_GITHUB_USERNAME;
    },
    async session({ session, token }) {
      // Attach isOwner flag to the session object
      if (session.user) {
        (session.user as any).isOwner = true;
      }
      return session;
    },
  },
  pages: {
    // Use default NextAuth pages for now.
    // A custom sign-in page can be added later if desired.
    error: '/api/auth/error',
  },
});
```

### 1c. Create API route handler

**File**: `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

Note: `@/auth` resolves to the root `auth.ts` file. Verify that
`tsconfig.json` paths include `"@/*": ["./src/*"]` and that the root
`auth.ts` is importable. If not, move `auth.ts` to `src/lib/auth.ts`
and update the import accordingly.

### 1d. TypeScript augmentation

**File**: `src/types/next-auth.d.ts` (NEW)

```typescript
import 'next-auth';

declare module 'next-auth' {
  interface User {
    isOwner?: boolean;
  }
  interface Session {
    user: User & {
      isOwner?: boolean;
    };
  }
}
```

### Verification

- [ ] `npm run build` passes.
- [ ] `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET` env vars
      documented (see Environment Variables section below).
- [ ] No changes to any existing page or component.

---

## Batch 2: Owner Context and Session Detection

### 2a. Create OwnerContext provider

**File**: `src/components/OwnerProvider.tsx` (NEW)

A client component that holds the owner session state and exposes it
via React context. Lightweight: no SessionProvider from NextAuth (that
pulls in unnecessary client-side bundle). Instead, the server component
passes the `isOwner` boolean down.

```typescript
'use client';

import { createContext, useContext } from 'react';

interface OwnerContextValue {
  isOwner: boolean;
}

const OwnerContext = createContext<OwnerContextValue>({ isOwner: false });

export function OwnerProvider({
  isOwner,
  children,
}: {
  isOwner: boolean;
  children: React.ReactNode;
}) {
  return (
    <OwnerContext.Provider value={{ isOwner }}>
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner(): OwnerContextValue {
  return useContext(OwnerContext);
}
```

### 2b. Add session check to root layout

**File**: `src/app/layout.tsx` (MODIFY)

Import `auth` from the auth config and `OwnerProvider`. Check the session
and pass the `isOwner` flag down. This wraps the entire app so every
page and component can access `useOwner()`.

```typescript
// Add these imports:
import { auth } from '@/auth';
import { OwnerProvider } from '@/components/OwnerProvider';

// In the RootLayout function, before the return:
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isOwner = session?.user?.isOwner === true;

  // ... existing themeScript code ...

  return (
    <html lang="en" className={fontVariableClasses} suppressHydrationWarning>
      <body
        className="min-h-screen flex flex-col overflow-x-clip"
        style={{ isolation: 'isolate' }}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <OwnerProvider isOwner={isOwner}>
            {children}
          </OwnerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Important**: The `auth()` call in the root layout makes it dynamic
for authenticated users. For unauthenticated visitors, `auth()` returns
null quickly (no external calls). Next.js handles this via Partial
Prerendering: the shell is static, the dynamic parts stream in. This
should not affect build performance or visitor-facing page speed.

If PPR is not enabled, the root layout becomes dynamic for all requests.
To avoid this, an alternative approach is to move the `auth()` check
into the (main) layout only, leaving the root layout fully static.
Choose based on whether PPR is enabled in `next.config.ts`.

### 2c. Create owner sign-in shortcut

**File**: `src/components/OwnerSignIn.tsx` (NEW)

A hidden sign-in trigger accessible via keyboard shortcut (Ctrl+Shift+L)
or by navigating to `/api/auth/signin`. No visible UI element on the
public site. Uses `react-hotkeys-hook` (already a dependency).

```typescript
'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { useOwner } from '@/components/OwnerProvider';

export default function OwnerSignIn() {
  const { isOwner } = useOwner();

  useHotkeys('ctrl+shift+l', () => {
    if (!isOwner) {
      window.location.href = '/api/auth/signin';
    }
  });

  // No visible UI
  return null;
}
```

Add `<OwnerSignIn />` to the `(main)` layout, after the existing
`<StudioShortcut />` component.

### 2d. Create owner sign-out utility

For completeness, add a sign-out action. This can be triggered from
the owner toolbar (built in the inline editing spec) or via
`/api/auth/signout`.

No separate component needed yet. The toolbar spec will use it.

### Verification

- [ ] `npm run build` passes.
- [ ] Visiting the site as an unauthenticated user: no visible changes,
      `useOwner()` returns `{ isOwner: false }`.
- [ ] Pressing Ctrl+Shift+L redirects to GitHub OAuth flow.
- [ ] After authenticating with the correct GitHub account, `useOwner()`
      returns `{ isOwner: true }` on all pages.
- [ ] Authenticating with a different GitHub account is rejected
      (redirected to error page).
- [ ] Session persists across page navigations (cookie-based).
- [ ] No impact on static page generation for unauthenticated visitors.

---

## Environment Variables

### Vercel (travisishere project)

```
AUTH_GITHUB_ID=<GitHub OAuth App Client ID>
AUTH_GITHUB_SECRET=<GitHub OAuth App Client Secret>
AUTH_SECRET=<random 32-byte base64 string>
```

Generate `AUTH_SECRET` with: `openssl rand -base64 32`

### GitHub OAuth App Setup

1. Go to GitHub Settings > Developer Settings > OAuth Apps > New OAuth App
2. Application name: `travisgilbert.me`
3. Homepage URL: `https://travisgilbert.me`
4. Authorization callback URL: `https://travisgilbert.me/api/auth/callback/github`
5. Copy the Client ID and Client Secret to Vercel env vars.

For local development, create a second OAuth app with callback URL
`http://localhost:3000/api/auth/callback/github` and add the credentials
to `.env.local`:

```
AUTH_GITHUB_ID=<local app client ID>
AUTH_GITHUB_SECRET=<local app client secret>
AUTH_SECRET=<any random string>
```

---

## What This Enables (Next Spec)

With this auth layer in place, the inline editing spec can:

1. Import `useOwner()` in any client component.
2. Conditionally render `<EditableArticle>` vs `<AnnotatedArticle>`.
3. Show/hide the owner toolbar.
4. Gate API calls (save, publish) behind the `isOwner` check.

The auth layer itself has zero visual impact on the public site.
It is purely infrastructure.

---

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `package.json` | MODIFY | Add `next-auth@beta` |
| `auth.ts` | NEW | Root-level NextAuth config |
| `src/app/api/auth/[...nextauth]/route.ts` | NEW | API route handler |
| `src/types/next-auth.d.ts` | NEW | TypeScript augmentation |
| `src/components/OwnerProvider.tsx` | NEW | Context provider |
| `src/components/OwnerSignIn.tsx` | NEW | Keyboard shortcut trigger |
| `src/app/layout.tsx` | MODIFY | Add auth check + OwnerProvider |
| `src/app/(main)/layout.tsx` | MODIFY | Add OwnerSignIn component |
