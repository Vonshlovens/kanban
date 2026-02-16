# Frontend Pages

## Overview

Pages are SvelteKit route modules — each page is a directory under `src/routes/` containing `+page.svelte` (UI) and `+page.server.ts` (data loading / form actions). Pages are thin shells that compose domain components and containers; all heavy logic lives in load functions and shared components.

## Page Map

Every page maps to a SvelteKit route directory. Route groups (`(app)`) provide shared layouts without affecting the URL.

| Page | Route Directory | Purpose |
| --- | --- | --- |
| Landing | `src/routes/` | Board list or redirect when only one board exists |
| Board List | `src/routes/(app)/boards/` | All boards overview with create action |
| Create Board | `src/routes/(app)/boards/new/` | New board form |
| Kanban Board | `src/routes/(app)/boards/[boardId]/` | Board view with columns and cards |
| Board Settings | `src/routes/(app)/boards/[boardId]/settings/` | Rename, delete, configure board |
| Card Detail | `src/routes/(app)/boards/[boardId]/cards/[cardId]/` | Full card view (labels, comments, due date, assignees) |
| Settings | `src/routes/(app)/settings/` | Application-level settings |

## Page Structure

Each page follows the same three-file pattern:

```
src/routes/(app)/boards/[boardId]/
├── +page.svelte        # UI — composes domain components
├── +page.server.ts     # Data loading and form actions
└── +layout.svelte      # Optional — board-scoped layout (header, nav)
```

## Landing Page

The root page loads all boards and either renders a board list or redirects to the single board.

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import BoardCard from "$lib/components/board/BoardCard.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Plus } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto max-w-4xl py-10">
  <div class="mb-8 flex items-center justify-between">
    <h1 class="text-3xl font-bold">Boards</h1>
    <Button href="/boards/new">
      <Plus class="mr-2 h-4 w-4" />
      New Board
    </Button>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.boards as board}
      <BoardCard {board} />
    {/each}
  </div>
</div>
```

```typescript
// src/routes/+page.server.ts
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/db";

export const load: PageServerLoad = async () => {
  const boards = await db.query.boards.findMany({
    orderBy: (boards, { desc }) => [desc(boards.updatedAt)],
  });

  // Single board — skip the listing page
  if (boards.length === 1) {
    throw redirect(303, `/boards/${boards[0].id}`);
  }

  return { boards };
};
```

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

Card detail can render as a standalone page or as a dialog overlay on top of the board. The load function fetches the full card with comments and activity.

```svelte
<!-- src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import CardDetail from "$lib/components/card/CardDetail.svelte";

  let { data }: { data: PageData } = $props();
</script>

<CardDetail card={data.card} boardId={data.boardId} />
```

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts
import type { PageServerLoad, Actions } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { updateCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";

export const load: PageServerLoad = async ({ params }) => {
  const card = await db.query.cards.findFirst({
    where: (cards, { eq }) => eq(cards.id, params.cardId),
    with: { labels: true, comments: true, assignees: true },
  });

  if (!card) throw error(404, "Card not found");

  return { card, boardId: params.boardId };
};

export const actions: Actions = {
  update: async ({ request, params }) => {
    const form = await superValidate(request, zod4(updateCardSchema));
    if (!form.valid) return fail(400, { form });

    await db
      .update(cards)
      .set(form.data)
      .where(eq(cards.id, params.cardId));

    return { form };
  },
};
```

## Board Settings Page

Board configuration — rename, manage columns, danger zone (delete).

```svelte
<!-- src/routes/(app)/boards/[boardId]/settings/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto max-w-2xl py-10 space-y-8">
  <h1 class="text-2xl font-bold">Board Settings</h1>

  <Card.Root>
    <Card.Header>
      <Card.Title>General</Card.Title>
    </Card.Header>
    <Card.Content>
      <form method="POST" action="?/rename" class="flex gap-3">
        <Input name="name" value={data.board.name} class="flex-1" />
        <Button type="submit">Save</Button>
      </form>
    </Card.Content>
  </Card.Root>

  <Card.Root class="border-destructive">
    <Card.Header>
      <Card.Title class="text-destructive">Danger Zone</Card.Title>
    </Card.Header>
    <Card.Content>
      <form method="POST" action="?/delete">
        <Button variant="destructive" type="submit">Delete Board</Button>
      </form>
    </Card.Content>
  </Card.Root>
</div>
```

## Create Board Page

Simple form with a single action.

```svelte
<!-- src/routes/(app)/boards/new/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";

  let { data }: { data: PageData } = $props();
</script>

<div class="container mx-auto flex max-w-md items-center justify-center py-20">
  <Card.Root class="w-full">
    <Card.Header>
      <Card.Title>Create Board</Card.Title>
      <Card.Description>Give your board a name to get started.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form method="POST" class="space-y-4">
        <Input name="name" placeholder="Board name" required />
        <Button type="submit" class="w-full">Create</Button>
      </form>
    </Card.Content>
  </Card.Root>
</div>
```

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
