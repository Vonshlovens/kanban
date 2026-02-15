# i18n, Analytics, and Observability

## Overview

Internationalization, analytics, and error-tracking configuration for the SvelteKit kanban app. i18n uses Paraglide JS (a Svelte-native, compile-time i18n library). Analytics and error tracking are provider-agnostic — the spec defines hook points, not vendor SDKs.

## Localization (Paraglide JS)

### Why Paraglide

Paraglide JS is built for SvelteKit. It generates tree-shakeable message functions at compile time — no runtime bundle, no context providers, no hydration mismatch. It integrates via a Vite plugin and SvelteKit hook.

### Languages

| Code  | Language             |
|-------|----------------------|
| `en`  | English (default)    |
| `fr`  | French               |
| `ja`  | Japanese             |
| `es`  | Spanish              |
| `ko`  | Korean               |
| `zh`  | Simplified Chinese   |
| `zh-TW` | Traditional Chinese |

### Translation Namespaces

Messages are organized by domain in `messages/`:

```
messages/
├── en/
│   ├── common.json
│   ├── settings.json
│   ├── projects.json
│   ├── tasks.json
│   └── organization.json
├── fr/
│   └── ...
└── ...
```

### Configuration

**Vite plugin** in `vite.config.ts`:

```typescript
import { paraglide } from '@inlang/paraglide-sveltekit/vite';

export default defineConfig({
  plugins: [
    paraglide({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
    }),
    sveltekit(),
    tailwindcss(),
  ],
});
```

**SvelteKit hook** in `src/hooks.server.ts`:

```typescript
import { i18n } from '$lib/paraglide/i18n';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = i18n.handle();
```

If other hooks exist, compose with `sequence`:

```typescript
import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '$lib/paraglide/i18n';

export const handle = sequence(i18n.handle(), authHandle);
```

**Reroute hook** in `src/hooks.ts`:

```typescript
import { i18n } from '$lib/paraglide/i18n';

export const reroute = i18n.reroute();
```

### Usage in Components

Paraglide generates typed message functions. Import and call them directly:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<h1>{m.board_title()}</h1>
<p>{m.card_count({ count: cards.length })}</p>
```

### Language Switching

```svelte
<script lang="ts">
  import { availableLanguageTags, languageTag } from '$lib/paraglide/runtime';
  import { i18n } from '$lib/paraglide/i18n';
  import { page } from '$app/stores';
</script>

<div class="flex gap-1">
  {#each availableLanguageTags as lang}
    <a
      href={i18n.route($page.url.pathname)}
      hreflang={lang}
      class="rounded px-2 py-1 text-sm transition-colors
        {lang === languageTag()
          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'}"
    >
      {lang.toUpperCase()}
    </a>
  {/each}
</div>
```

### Language Detection

Paraglide-SvelteKit handles detection automatically via URL-based routing (e.g., `/fr/boards`). The default language (`en`) uses unprefixed paths. No client-side detection library is needed.

User preference can be persisted in the database and applied server-side by redirecting in a layout load function:

```typescript
// src/routes/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import { languageTag } from '$lib/paraglide/runtime';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (user?.preferredLanguage && user.preferredLanguage !== languageTag()) {
    // Redirect to preferred language prefix
    redirect(302, `/${user.preferredLanguage}/`);
  }
};
```

### File Locations

| File | Purpose |
|------|---------|
| `project.inlang/settings.json` | Inlang project config (source language, languages) |
| `messages/{lang}/*.json` | Translation message files |
| `src/lib/paraglide/` | Generated runtime (auto — do not edit) |
| `vite.config.ts` | Paraglide Vite plugin registration |
| `src/hooks.server.ts` | `i18n.handle()` middleware |
| `src/hooks.ts` | `i18n.reroute()` for URL rewriting |

## Analytics

Analytics is provider-agnostic. The app defines a thin wrapper that can target PostHog, Plausible, or any provider. Analytics is **opt-in** — no tracking fires unless the user has consented or the environment is configured.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `PUBLIC_ANALYTICS_ENDPOINT` | Analytics ingest URL (empty = disabled) |
| `PUBLIC_ANALYTICS_KEY` | Project/site key for the analytics provider |

SvelteKit uses the `PUBLIC_` prefix for client-exposed env vars (replaces `VITE_` convention).

### Analytics Wrapper

```typescript
// src/lib/services/analytics.ts
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const isEnabled = browser && !!env.PUBLIC_ANALYTICS_ENDPOINT;

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!isEnabled) return;
  // Delegate to provider SDK (PostHog, Plausible, etc.)
  // navigator.sendBeacon or fetch to PUBLIC_ANALYTICS_ENDPOINT
}

export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!isEnabled) return;
  // Provider-specific identify call
}
```

### Tracking in Components

Use `$effect` for page-level or session-level events:

```svelte
<script lang="ts">
  import { trackEvent } from '$lib/services/analytics';

  let { data } = $props();

  $effect(() => {
    trackEvent('board_viewed', { boardId: data.board.id });
  });
</script>
```

### Consent

If consent is required, gate analytics initialization behind a user preference stored in a cookie or the database. Check the flag in the analytics wrapper before firing events.

## Error Tracking

Error tracking is also provider-agnostic. The spec defines SvelteKit integration points — wire in Sentry, LogRocket, or any provider.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `PUBLIC_SENTRY_DSN` | Sentry DSN (empty = disabled) |

### SvelteKit Error Hooks

**Client errors** — `src/hooks.client.ts`:

```typescript
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
  if (env.PUBLIC_SENTRY_DSN) {
    // Sentry.captureException(error, { extra: { status, message } });
  }
  console.error('Client error:', error);
  return { message: 'An unexpected error occurred.' };
};
```

**Server errors** — `src/hooks.server.ts`:

```typescript
import { env } from '$env/dynamic/public';
import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ error, event, status, message }) => {
  if (env.PUBLIC_SENTRY_DSN) {
    // Sentry.captureException(error, { extra: { status, message, url: event.url.pathname } });
  }
  console.error('Server error:', error);
  return { message: 'An unexpected error occurred.' };
};
```

### Error Boundary

SvelteKit provides `+error.svelte` pages per route segment. No wrapper component is needed:

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="flex min-h-[50vh] flex-col items-center justify-center gap-4">
  <h1 class="text-4xl font-bold text-neutral-900 dark:text-white">
    {$page.status}
  </h1>
  <p class="text-neutral-600 dark:text-neutral-400">
    {$page.error?.message ?? 'Something went wrong.'}
  </p>
  <a
    href="/"
    class="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
  >
    Back to home
  </a>
</div>
```

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/services/analytics.ts` | Analytics wrapper (provider-agnostic) |
| `src/hooks.server.ts` | i18n handle + server error hook |
| `src/hooks.client.ts` | Client error hook |
| `src/hooks.ts` | i18n reroute |
| `src/routes/+error.svelte` | Global error page |
| `messages/` | Translation files |
| `project.inlang/settings.json` | Paraglide / Inlang config |
