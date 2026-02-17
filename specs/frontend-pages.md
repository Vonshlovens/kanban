# Frontend Pages

## Overview

Pages are SvelteKit route modules — each page is a directory under `src/routes/` containing `+page.svelte` (UI) and `+page.server.ts` (data loading / form actions). Pages are thin shells that compose domain components and containers; all heavy logic lives in load functions and shared components.

## Page Map

Every page maps to a SvelteKit route directory. Route groups (`(app)`) provide shared layouts without affecting the URL.

| Page | Route Directory | Purpose | Status |
| --- | --- | --- | --- |
| Landing | `src/routes/` | Board list or redirect when only one board exists | Implemented |
| Create Board | `src/routes/(app)/boards/new/` | New board form | Implemented |
| Kanban Board | `src/routes/(app)/boards/[boardId]/` | Board view with columns and cards | Implemented |
| Board Settings | `src/routes/(app)/boards/[boardId]/settings/` | Rename, delete, favorite, configure board | Implemented |
| Card Detail | `src/routes/(app)/boards/[boardId]/cards/[cardId]/` | Full card view (labels, comments, due date, assignees) | Implemented |
| Settings | `src/routes/(app)/settings/` | Application-level settings | Planned |

## Page Structure

Each page follows the same three-file pattern:

```
src/routes/(app)/boards/[boardId]/
├── +page.svelte        # UI — composes domain components
├── +page.server.ts     # Data loading and form actions
└── +layout.svelte      # Optional — board-scoped layout (header, nav)
```

## Landing Page

> **Status:** Implemented.

The root page loads all boards as `BoardSummary` (from `$lib/types`) sorted by updatedAt desc and either renders a board list or redirects if only one board exists. Board cards are rendered inline using the shadcn Card component — no separate `BoardCard` component. The page lives outside the `(app)` layout group (no sidebar).

See `specs/board-management.md` for the full server load function and implementation details.

## Kanban Board Page

The main board page loads columns and cards, then renders the board view.

```svelte
<!-- src/routes/(app)/boards/[boardId]/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import BoardView from "$lib/components/board/BoardView.svelte";

  let { data }: { data: PageData } = $props();
</script>

<BoardView board={data.board} />
```

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { db } from "$lib/db";

export const load: PageServerLoad = async ({ params }) => {
  const board = await db.query.boards.findFirst({
    where: (boards, { eq }) => eq(boards.id, params.boardId),
    with: {
      columns: {
        orderBy: (columns, { asc }) => [asc(columns.position)],
        with: {
          cards: {
            orderBy: (cards, { asc }) => [asc(cards.position)],
            with: { labels: true, assignees: true },
          },
        },
      },
    },
  });

  if (!board) throw error(404, "Board not found");

  return { board };
};
```

## Card Detail Page

> **Status:** Implemented.

Card detail renders as a standalone page. The load function fetches the full card with column, labels, and comments (with authors).

```svelte
<!-- src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.svelte -->
<script lang="ts">
  import CardDetail from "$lib/components/card/CardDetail.svelte";

  let { data } = $props();
</script>

<CardDetail card={data.card} boardId={data.boardId} columns={data.columns} boardLabels={data.boardLabels} updateForm={data.updateForm} currentUserId={data.currentUserId} />
```

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts
import type { PageServerLoad, Actions } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { updateCardSchema, deleteCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";
import { cards } from "$lib/db/schema/cards";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ params }) => {
  const card = await db.query.cards.findFirst({
    where: (cards, { eq }) => eq(cards.id, params.cardId),
    with: {
      column: true,
      cardLabels: { with: { label: true } },
      comments: {
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        with: { author: true },
      },
    },
  });

  if (!card) throw error(404, "Card not found");

  const updateForm = await superValidate(
    { title: card.title, description: card.description ?? "" },
    zod4(updateCardSchema),
  );

  return { card, boardId: params.boardId, updateForm };
};

export const actions: Actions = {
  update: async ({ request, params }) => {
    const form = await superValidate(request, zod4(updateCardSchema));
    if (!form.valid) return fail(400, { updateForm: form });

    await db.update(cards)
      .set({ ...form.data, updatedAt: new Date() })
      .where(eq(cards.id, params.cardId));

    return { updateForm: form };
  },

  deleteCard: async ({ request, params }) => {
    const form = await superValidate(request, zod4(deleteCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.delete(cards).where(eq(cards.id, form.data.cardId));

    throw redirect(303, `/boards/${params.boardId}`);
  },
};
```

## Board Settings Page

> **Status:** Implemented.

Board configuration — rename, update description, toggle favorite, and delete (with AlertDialog confirmation). Uses superForm for rename and description forms, a hidden form + `requestSubmit()` pattern for delete.

See `specs/board-management.md` for the full implementation details and patterns.

## Create Board Page

> **Status:** Implemented.

Centered card form (max-w-md) with name input (required) and optional description textarea with character count. Uses superForm with a default action that creates the board + 3 default columns in a transaction, then redirects to the new board.

See `specs/board-management.md` for the full implementation details.

## App Settings Page

Application-level preferences — theme, display options.

```svelte
<!-- src/routes/(app)/settings/+page.svelte -->
<script lang="ts">
  import { toggleMode, mode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button";
  import { Sun, Moon } from "@lucide/svelte";
</script>

<div class="container mx-auto max-w-2xl py-10 space-y-8">
  <h1 class="text-2xl font-bold">Settings</h1>

  <section class="space-y-3">
    <h2 class="text-lg font-semibold">Appearance</h2>
    <Button variant="outline" onclick={toggleMode}>
      {#if mode.current === "dark"}
        <Sun class="mr-2 h-4 w-4" /> Light Mode
      {:else}
        <Moon class="mr-2 h-4 w-4" /> Dark Mode
      {/if}
    </Button>
  </section>
</div>
```

## Page Composition Pattern

Pages are thin — they receive data from load functions and delegate rendering to domain components:

```
+page.server.ts  →  load()   →  returns { board, cards, ... }
+page.svelte     →  { data }  →  <BoardView board={data.board} />
```

Pages should not contain business logic, direct database calls, or complex state management. Keep pages under ~50 lines by extracting UI into `$lib/components/`.

## Common Page Patterns

- **Data loading** — `+page.server.ts` load functions with Drizzle queries
- **Mutations** — SvelteKit form actions validated with sveltekit-superforms + Zod
- **Redirects** — `redirect(303, "/path")` in load functions or after form actions
- **Errors** — `error(404)` in load functions; `fail(400, { form })` for validation
- **Navigation** — Standard `<a href>` links; `goto()` for programmatic navigation

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/routes/+layout.svelte` | Root layout (ModeWatcher, Toaster, global CSS) |
| `src/routes/+page.svelte` | Landing page / board redirect |
| `src/routes/+error.svelte` | Global error boundary |
| `src/routes/(app)/+layout.svelte` | App shell (sidebar, navbar, main slot) |
| `src/routes/(app)/boards/` | Board listing and creation pages |
| `src/routes/(app)/boards/[boardId]/` | Board view, settings, card detail |
| `src/routes/(app)/settings/` | Application settings |
