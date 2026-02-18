# Kanban App - Agent Guidelines

This file provides essential guidance to AI coding assistants when working with the Kanban codebase.

> **Note:** `CLAUDE.md` is a symlink to this file — editing either one changes both.

## Specifications

**IMPORTANT:** Before implementing any feature, consult the specifications in `specs/README.md`.

- **Assume NOT implemented.** Many specs describe planned features that may not yet exist in the codebase.
- **Check the codebase first.** Before concluding something is or isn't implemented, search the actual code. Specs describe intent; code describes reality.
- **Use specs as guidance.** When implementing a feature, follow the design patterns, types, and architecture defined in the relevant spec.
- **Spec index:** `specs/README.md` lists all specifications organized by category.

## Project Overview

**Kanban** is a SvelteKit full-stack kanban board application for project and task management.

**Core Purpose:** Provide a clean, responsive kanban board UI with boards, columns, cards, labels, due dates, comments, drag-and-drop, and search/filtering.

## Tech Stack

- **Runtime:** Deno
- **Framework:** SvelteKit 2 + Svelte 5 (runes mode)
- **Language:** TypeScript (strict mode)
- **Build:** Vite
- **Database:** PostgreSQL + Drizzle ORM
- **Styling:** Tailwind CSS 4
- **Component Library:** shadcn-svelte + bits-ui
- **Icons:** Lucide Svelte
- **Forms:** sveltekit-superforms + formsnap + Zod 4
- **Utilities:** tailwind-merge, tailwind-variants, clsx, tw-animate-css
- **Theme:** mode-watcher (dark mode)
- **Toast:** svelte-sonner

## Frontend Design

When building or redesigning frontend pages, components, or UI features, use the `/frontend-design` skill. It produces distinctive, production-grade interfaces with high design quality and avoids generic AI aesthetics. Always prefer this skill over writing frontend code from scratch.

## Svelte 5 Gotchas

These are common mistakes to avoid when writing Svelte 5 code in this project.

### `<svelte:component>` is deprecated

In runes mode, components are dynamic by default. Use the component directly:

```svelte
<!-- WRONG — triggers deprecation warning -->
<svelte:component this={pipeline.icon} class="h-4 w-4" />

<!-- RIGHT — components are already dynamic in Svelte 5 -->
<pipeline.icon class="h-4 w-4" />
```

### `{@const}` placement is restricted

`{@const}` can only be an immediate child of `{#if}`, `{:else}`, `{#each}`, `{:then}`, `{:catch}`, `{#snippet}`, `<svelte:fragment>`, `<svelte:boundary>`, or `<Component>`. It **cannot** be placed inside plain HTML elements.

```svelte
<!-- WRONG — @const inside <button> -->
<button>
  {@const Icon = item.icon}
  <Icon />
</button>

<!-- RIGHT — use @const inside the {#each} block, before the element -->
{#each items as item}
  {@const Icon = item.icon}
  <button><Icon /></button>
{/each}

<!-- ALSO RIGHT — just reference the property directly -->
<button><item.icon class="h-4 w-4" /></button>
```

### Tabs component is available

shadcn-svelte now includes a Tabs component. Use `import * as Tabs from "$lib/components/ui/tabs"` with `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, and `Tabs.Content`.

## Kanban Board

Task board lives in `kanban.yaml`. ID prefixes match columns: **B**=backlog, **T**=todo, **P**=progress, **R**=review, **D**=done.

**Skills:**
- `/tackle <id>` — implement a task end-to-end: read it, code it, move to done, update specs, commit
- `/kanban <description>` — research specs/code and create a new task
- `/kanban-query [command]` — query the board: list, search, get details, stats
- `/kanban-move <id> <column>` — move a task between columns (auto-fixes ID prefix)

### Kanban CLI (`scripts/kanban-cli.ts`)

Bun-powered CLI for querying and managing `kanban.yaml`. Prefer this over reading raw YAML — it's faster and handles filtering, searching, and ID generation.

```bash
bun scripts/kanban-cli.ts stats                        # Board overview (counts by column/tag/priority)
bun scripts/kanban-cli.ts list --column todo            # List tasks in a column
bun scripts/kanban-cli.ts list --tag frontend --json    # Filter by tag, JSON output
bun scripts/kanban-cli.ts search "drag"                 # Search titles + descriptions
bun scripts/kanban-cli.ts get T-15                      # Full task details (description, subtasks, links)
bun scripts/kanban-cli.ts get T-15 --json               # Same, structured JSON
bun scripts/kanban-cli.ts next-id backlog               # Next available ID (e.g., B-4)
```

Adding tasks (used by `/kanban` skill):
```bash
cat <<'EOF' | bun scripts/kanban-cli.ts add --column backlog
{"title":"...","description":"...","priority":"high","tags":["frontend"],"subtasks":[{"text":"Step 1","done":false}],"links":["specs/foo.md"]}
EOF
```

**Recommended workflow when exploring the board:**
1. `stats` — orient yourself (how many tasks, where they are)
2. `search "<keywords>"` — check for duplicates or related work
3. `list --column <col>` — browse a specific column
4. `get <id>` — deep-dive into a task before working on it

All commands support `--json` for structured output when you need to process results programmatically.

### Other Scripts

- `deno run -A scripts/kanban-move.ts <id> <column> [--dry-run]` — move task between columns
- `deno run -A scripts/fix-kanban-ids.ts [--dry-run]` — bulk-fix mismatched ID prefixes

Column aliases for move: `progress`, `ip`, `wip` all resolve to `in_progress`.
