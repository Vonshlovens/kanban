# Kanban App — Specs Index

Specifications for the Kanban application. Each spec focuses on a different slice of the system.

## Tech Stack

| Spec | Code | Purpose |
|------|------|---------|
| `tech-stack-overview.md` | `svelte.config.js`, `vite.config.ts`, `deno.json`, `tsconfig.json` | Runtime, framework, language, build, project structure |
| `tech-database.md` | `src/lib/db/schema/`, `src/lib/db/index.ts`, `drizzle.config.ts`, `drizzle/` | PostgreSQL + Drizzle ORM schemas, migrations, queries |
| `tech-frontend-ui.md` | `src/lib/components/ui/`, `app.css` | shadcn-svelte, Tailwind CSS 4, bits-ui, icons, forms |
| `tech-containerization.md` | `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Docker, Docker Compose, local dev workflow |

## Feature Specs

| Spec | Code | Purpose |
|------|------|---------|
| `board-management.md` | `src/routes/boards/`, `src/lib/components/boards/` | Create, rename, delete, list boards |
| `columns.md` | `src/routes/boards/[boardId]/`, `src/lib/components/columns/` | Column CRUD, reordering, WIP limits |
| `cards.md` | `src/lib/components/cards/`, `src/routes/api/cards/` | Card CRUD, move, detail view, rich text |
| `due-dates.md` | `src/lib/components/due-date/`, `src/lib/utils/dates.ts` | Due date management, urgency indicators |
| `labels.md` | `src/lib/components/labels/`, `src/routes/api/labels/` | Label CRUD, assignment, filtering |
| `user-assignment.md` | `src/lib/components/user-assignment/` | User assignment, avatars |
| `comments.md` | `src/lib/components/comments/`, `src/routes/api/comments/` | Comment CRUD, rich text |
| `activity-log.md` | `src/lib/components/activity-log/`, `src/lib/server/activity/` | Audit trail, event tracking |
| `drag-and-drop.md` | `src/lib/actions/dnd.ts`, `src/lib/components/dnd/` | Card/column drag, visual feedback, accessibility |
| `search-and-filter.md` | `src/lib/components/search/`, `src/lib/components/filters/` | Text search, multi-filter |

## Frontend Architecture

These specs describe the SvelteKit frontend patterns (converted from earlier React-based designs).

| Spec | Code | Purpose |
|------|------|---------|
| `frontend-overview.md` | `src/routes/+layout.svelte`, `src/app.html` | Tech stack overview, entry points, layout strategy |
| `frontend-routing.md` | `src/routes/**/+page.svelte`, `src/routes/**/+layout.ts` | SvelteKit file-based routing, layouts, load functions |
| `frontend-pages.md` | `src/routes/**/+page.svelte` | Page components and route-level UI |
| `frontend-styling.md` | `app.css`, `src/lib/utils.ts` | Tailwind CSS 4 config, theme, utility classes |
| `frontend-components.md` | `src/lib/components/` | Svelte 5 + shadcn-svelte component patterns |
| `frontend-state-data.md` | `src/lib/stores/`, component-level runes | State management with Svelte 5 runes and stores |
| `frontend-dialogs.md` | `src/lib/components/dialogs/` | Dialog/modal patterns using bits-ui |
| `frontend-editor-diff.md` | `src/lib/components/editor/` | Rich text editor and diff viewer |
| `frontend-build-tooling.md` | `vite.config.ts`, `svelte.config.js`, `deno.json` | Build tooling with Vite + Deno |
| `frontend-i18n-analytics.md` | `src/lib/i18n/`, `src/lib/analytics/` | Internationalization and analytics |
