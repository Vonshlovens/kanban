# Kanban App — Specs Index

Specifications for the Kanban application. Each spec focuses on a different slice of the system.

## Tech Stack

- `specs/tech-stack-overview.md` — Runtime, framework, language, build, project structure
- `specs/tech-database.md` — PostgreSQL + Drizzle ORM schemas, migrations, queries
- `specs/tech-frontend-ui.md` — shadcn-svelte, Tailwind CSS 4, bits-ui, icons, forms
- `specs/tech-containerization.md` — Docker, Docker Compose, local dev workflow

## Feature Specs

- `specs/board-management.md` — Create, rename, delete, list boards
- `specs/columns.md` — Column CRUD, reordering, WIP limits
- `specs/cards.md` — Card CRUD, move, detail view, rich text
- `specs/due-dates.md` — Due date management, urgency indicators
- `specs/labels.md` — Label CRUD, assignment, filtering
- `specs/user-assignment.md` — User assignment, avatars
- `specs/comments.md` — Comment CRUD, rich text
- `specs/activity-log.md` — Audit trail, event tracking
- `specs/drag-and-drop.md` — Card/column drag, visual feedback, accessibility
- `specs/search-and-filter.md` — Text search, multi-filter

## Frontend Architecture Specs (Converting from React → SvelteKit)

These specs currently describe React patterns and need conversion to SvelteKit equivalents. See `kanban.yaml` for tracking tasks.

- `specs/frontend-overview.md` — Tech stack overview, entry points, layout strategy
- `specs/frontend-routing.md` — Routing (React Router → SvelteKit file routing)
- `specs/frontend-pages.md` — Pages (React → SvelteKit routes)
- `specs/frontend-styling.md` — Styling (needs Tailwind 4 update)
- `specs/frontend-components.md` — Components (React → Svelte 5 + shadcn-svelte)
- `specs/frontend-state-data.md` — State (Zustand → Svelte runes/stores)
- `specs/frontend-dialogs.md` — Dialogs (NiceModal → bits-ui)
- `specs/frontend-editor-diff.md` — Editor/diff (Lexical React → Svelte alternative)
- `specs/frontend-build-tooling.md` — Build tooling (Vite React → Vite + Deno)
- `specs/frontend-i18n-analytics.md` — i18n and analytics
