# Tech Stack Overview

This spec defines the core technology choices for the Kanban application, modeled after the CWL API stack (core framework only, no AI/cloud services).

## Runtime & Framework

| Layer       | Technology            | Version   |
|-------------|-----------------------|-----------|
| Runtime     | Deno                  | latest    |
| Framework   | SvelteKit             | ^2.x      |
| Frontend    | Svelte 5 (runes mode) | ^5.x      |
| Language    | TypeScript            | ^5.x      |
| Build       | Vite                  | ^7.x      |

### Deno

Deno is the JavaScript/TypeScript runtime. It provides built-in TypeScript support, secure-by-default permissions, and npm compatibility.

**Configuration:** `deno.json` at the project root defines:
- Task definitions (dev, build, preview, check, lint, format, db commands)
- Compiler options (strict mode, checkJs: false)
- `"nodeModulesDir": "auto"` — required for npm package compatibility with SvelteKit
- `"unstable": ["sloppy-imports"]` — allows importing without explicit file extensions

**Dependencies:** npm packages are managed via `package.json` (Deno reads it natively). No import maps needed — Deno resolves npm dependencies from `package.json` automatically.

### SvelteKit

SvelteKit is the full-stack framework providing:
- File-based routing (`src/routes/`)
- Server-side rendering (SSR)
- API endpoints (`+server.ts`)
- Load functions (`+page.server.ts`, `+layout.server.ts`)
- Form actions for mutations

**Adapter:** `@deno/svelte-adapter` for Deno deployment, with `@sveltejs/adapter-auto` as fallback.

### Svelte 5 (Runes Mode)

All components use Svelte 5 runes:
- `$state()` for reactive state
- `$derived()` for computed values
- `$effect()` for side effects
- `$props()` for component props
- `$bindable()` for two-way binding

### TypeScript

Strict mode enabled. Configuration in `tsconfig.json`:
- `strict: true`
- `moduleResolution: "bundler"`
- Source maps enabled

### Vite

Build tool with plugins:
- `@tailwindcss/vite` — Tailwind CSS 4 integration
- `@sveltejs/vite-plugin-svelte` — Svelte compilation

## Project Structure

```
kanban/
├── src/
│   ├── lib/
│   │   ├── components/    # Svelte UI components
│   │   ├── db/            # Database schemas & connection
│   │   ├── schemas/       # Zod validation schemas
│   │   ├── services/      # Business logic
│   │   ├── stores/        # Shared reactive state
│   │   ├── styles/        # Global CSS / Tailwind
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Utility functions
│   └── routes/            # SvelteKit pages & API endpoints
├── drizzle/               # ORM migrations
├── scripts/               # Automation (kanban CLI, etc.)
├── specs/                 # Specification documents
├── static/                # Public assets
├── kanban.yaml            # Project task board
├── deno.json              # Deno config & import maps
├── svelte.config.js       # SvelteKit config
├── vite.config.ts         # Vite config
└── tsconfig.json          # TypeScript config
```

## Development Workflow

**Local dev:** `deno task dev` — starts Vite dev server with hot reload.

**Build:** `deno task build` — production build.

**Preview:** `deno task preview` — preview built app locally.

**Database:**
- `deno task db:generate` — generate Drizzle migrations
- `deno task db:migrate` — run migrations
- `deno task db:push` — push schema to database
- `deno task db:studio` — interactive Drizzle Studio
