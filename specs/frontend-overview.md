# Frontend Overview

## Purpose
The frontend delivers a Kanban-style project and task management experience with a unified design system built on SvelteKit.

## Tech Stack
- Deno runtime with SvelteKit 2 and Svelte 5 (runes mode).
- TypeScript in strict mode.
- Vite build pipeline with `@tailwindcss/vite` and `@sveltejs/vite-plugin-svelte`.
- Tailwind CSS 4 for utility-first styling.
- shadcn-svelte + bits-ui for UI primitives and components.
- Zod 4 for schema validation; sveltekit-superforms + formsnap for form handling.
- Lucide Svelte for icons.
- mode-watcher for dark mode.
- svelte-sonner for toast notifications.

## Entry Point
- `src/routes/+layout.svelte` — root layout providing global providers, theme, and navigation shell.
- `src/routes/+page.svelte` — landing / board list page.
- `src/app.html` — HTML shell with `%sveltekit.head%` and `%sveltekit.body%` placeholders.
- `src/app.css` — global Tailwind CSS 4 imports and design tokens.

## Layout Strategy
- A single root layout (`+layout.svelte`) renders the app shell: navigation bar, sidebar, and a `<slot />` for page content.
- Nested layouts in `src/routes/(app)/` group authenticated pages sharing the board chrome.
- No dual design scopes — one unified design system across all routes.

## UI Domains
- Board management: create, rename, delete, and switch boards.
- Columns: CRUD, reordering, WIP limits.
- Cards: CRUD, drag-and-drop, detail panel with rich text.
- Labels, due dates, and user assignment.
- Comments with rich text editing.
- Search and filtering across cards.

## Where To Start
- Routes: `src/routes/` — SvelteKit file-based routing.
- Components: `src/lib/components/` — reusable Svelte 5 components (shadcn-svelte based).
- State: `src/lib/stores/` — Svelte runes-based reactive state.
- Database: `src/lib/db/` — Drizzle ORM schemas and queries.
- Styles: `src/app.css` and `src/lib/styles/` — Tailwind CSS 4 configuration.
- Full tech stack details: `specs/tech-stack-overview.md`.
