# Frontend Styling

## Overview

A single, unified design system powered by Tailwind CSS 4. No dual scopes, no legacy themes — one token system, one stylesheet, one set of conventions.

## Tailwind CSS 4

Tailwind CSS 4 is used via the Vite plugin — no `tailwind.config.js` required.

| Package                | Purpose                        |
|------------------------|--------------------------------|
| `tailwindcss`          | Utility-first CSS framework    |
| `@tailwindcss/vite`    | Vite plugin (replaces PostCSS) |
| `tailwind-merge`       | Safe class deduplication       |
| `tailwind-variants`    | Component variant patterns     |
| `tw-animate-css`       | Animation utilities            |
| `clsx`                 | Conditional class joining      |

### Vite Integration

Tailwind CSS 4 registers as a Vite plugin — no PostCSS config needed:

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

### `cn()` Utility

All class composition goes through `cn()` in `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Use `cn()` whenever merging conditional or user-supplied classes to avoid Tailwind conflicts.

### Type Helpers

`src/lib/utils.ts` also exports type helpers required by shadcn-svelte components:

```typescript
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
```

These types are used by generated shadcn-svelte components for prop inference and element ref binding.

## Global Stylesheet

`src/app.css` is the single entry point for global styles. It imports Tailwind and defines the design token system:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));
```

The file defines all CSS custom properties in `:root` (light) and `.dark` (dark) scopes.

## Design Token System

Tokens are CSS custom properties defined in `src/app.css` and consumed by Tailwind via `@theme`.

### Color Tokens

Defined as raw OKLCH values for wide-gamut color support:

| Token               | Purpose                      |
|----------------------|------------------------------|
| `--background`       | Page background              |
| `--foreground`       | Default text                 |
| `--primary`          | Primary actions / emphasis   |
| `--primary-foreground` | Text on primary            |
| `--secondary`        | Secondary actions            |
| `--secondary-foreground` | Text on secondary        |
| `--muted`            | Subtle backgrounds           |
| `--muted-foreground` | Deemphasized text            |
| `--accent`           | Highlights, hover states     |
| `--accent-foreground` | Text on accent              |
| `--destructive`      | Delete, error actions        |
| `--border`           | Default border color         |
| `--input`            | Form input borders           |
| `--ring`             | Focus ring color             |
| `--radius`           | Base border radius           |

### Semantic Tokens

| Token           | Purpose             |
|-----------------|---------------------|
| `--card`        | Card background      |
| `--card-foreground` | Card text        |
| `--popover`     | Popover background   |
| `--popover-foreground` | Popover text  |
| `--sidebar-*`   | Sidebar variants     |
| `--chart-*`     | Data viz colors      |

### Theme Registration

Tokens are registered with Tailwind via `@theme inline`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... remaining token mappings */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

This allows usage like `bg-primary`, `text-muted-foreground`, `rounded-lg` everywhere.

## Dark Mode

Dark mode is managed by `mode-watcher`, which toggles a `.dark` class on `<html>`.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { ModeWatcher } from "mode-watcher";

  let { children } = $props();
</script>

<ModeWatcher />
{@render children()}
```

The custom variant `@custom-variant dark (&:is(.dark *))` lets Tailwind's `dark:` prefix work with the class-based toggle.

### Token Overrides

Dark-mode values are defined under `.dark` in `src/app.css`:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ... */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... */
}
```

Components never check the theme directly — they use token classes (`bg-background`, `text-foreground`) and colors swap automatically.

## Fonts

Fonts are loaded via `@fontsource` packages or `<link>` tags in `src/app.html` and applied through Tailwind's `font-sans` / `font-mono` utilities.

| Family    | Usage                |
|-----------|----------------------|
| Sans-serif | UI text, headings   |
| Monospace  | Code, IDs, metadata |

Font families are registered via `@theme`:

```css
@theme inline {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

## Component Variants

Use `tailwind-variants` for multi-variant component styling:

```typescript
import { tv } from "tailwind-variants";

const badge = tv({
  base: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  variants: {
    color: {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      outline: "border border-border text-foreground",
    },
  },
  defaultVariants: {
    color: "default",
  },
});
```

## Animations

`tw-animate-css` provides standard animation utilities. Custom keyframes can be added in `src/app.css` when needed for specific interactions (drag-and-drop feedback, card transitions).

## shadcn-svelte Theming

`components.json` at the project root configures shadcn-svelte component generation:

```json
{
  "$schema": "https://shadcn-svelte.com/schema.json",
  "style": "default",
  "tailwind": {
    "css": "src/app.css",
    "baseColor": "slate"
  },
  "aliases": {
    "components": "$lib/components",
    "utils": "$lib/utils",
    "hooks": "$lib/hooks",
    "ui": "$lib/components/ui"
  },
  "registry": "https://shadcn-svelte.com/registry"
}
```

> **Note:** Tailwind CSS 4 no longer uses a `tailwind.config.js` file — the `"config"` field in `components.json` is omitted. All tokens and configuration are defined in `src/app.css`.

All generated components inherit the token system from `src/app.css`.

## Base Styles

Global resets and base styles live in `src/app.css`:

```css
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

## File Locations

| File                        | Purpose                             |
|-----------------------------|-------------------------------------|
| `src/app.css`               | Tailwind imports, tokens, base styles |
| `src/lib/utils.ts`          | `cn()` helper + type utilities      |
| `components.json`           | shadcn-svelte configuration         |
| `vite.config.ts`            | Tailwind Vite plugin registration   |
