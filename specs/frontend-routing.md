# Frontend Routing

## Overview

SvelteKit file-based routing — no router configuration needed. Each route is a directory under `src/routes/` containing `+page.svelte`, `+page.server.ts`, and/or `+layout.svelte` files.

## Route Tree

All routes live in `src/routes/`. Route groups (`(group)`) organize layouts without affecting the URL.

| Path | Route Directory | Layout | Purpose |
| --- | --- | --- | --- |
| `/` | `src/routes/` | Root | Landing / board list (redirects if only one board) |
| `/boards` | `src/routes/boards/` | App | All boards listing |
| `/boards/new` | `src/routes/boards/new/` | App | Create a new board |
| `/boards/[boardId]` | `src/routes/boards/[boardId]/` | App | Kanban board view |
| `/boards/[boardId]/settings` | `src/routes/boards/[boardId]/settings/` | App | Board settings (rename, delete) |
| `/boards/[boardId]/cards/[cardId]` | `src/routes/boards/[boardId]/cards/[cardId]/` | App | Card detail (rendered as overlay or standalone) |
| `/settings` | `src/routes/settings/` | App | Application settings |

## File Structure

```
src/routes/
├── +layout.svelte              # Root layout: ModeWatcher, global providers
├── +layout.server.ts           # Root load: session, theme preference
├── +page.svelte                # Landing page / board redirect
├── +page.server.ts             # Load boards list, redirect logic
├── +error.svelte               # Global error boundary
├── (app)/
│   ├── +layout.svelte          # App shell: nav bar, sidebar, slot
│   ├── +layout.server.ts       # Auth guard, user data
│   ├── boards/
│   │   ├── +page.svelte        # Board listing
│   │   ├── +page.server.ts     # Load all boards
│   │   ├── new/
│   │   │   ├── +page.svelte    # Create board form
│   │   │   └── +page.server.ts # Form action: create board
│   │   └── [boardId]/
│   │       ├── +page.svelte    # Kanban board view
│   │       ├── +page.server.ts # Load board with columns & cards
│   │       ├── +layout.svelte  # Board-level layout (board header)
│   │       ├── settings/
│   │       │   ├── +page.svelte    # Board settings
│   │       │   └── +page.server.ts # Board update/delete actions
│   │       └── cards/
│   │           └── [cardId]/
│   │               ├── +page.svelte    # Card detail view
│   │               └── +page.server.ts # Load card, form actions
│   └── settings/
│       ├── +page.svelte        # App settings
│       └── +page.server.ts     # Settings load/actions
```

## Route Groups

The `(app)` route group wraps all authenticated pages in a shared layout without adding `/app` to the URL:

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { Provider as SidebarProvider } from "$lib/components/ui/sidebar/index.js";
  import AppSidebar from "$lib/components/layout/AppSidebar.svelte";
  import Navbar from "$lib/components/layout/Navbar.svelte";

  let { data, children }: { data: any; children: Snippet } = $props();

  let activeBoardId = $derived($page.params.boardId);
  let boardName = $derived(
    activeBoardId
      ? data.boards.find((b: { id: string }) => b.id === activeBoardId)?.name
      : undefined
  );
</script>

<SidebarProvider>
  <AppSidebar boards={data.boards} {activeBoardId} />
  <div class="flex flex-1 flex-col overflow-hidden">
    <Navbar {boardName} />
    <main class="flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
</SidebarProvider>
```

## Layouts

### Root Layout (`+layout.svelte`)

The outermost layout provides global concerns:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "svelte-sonner";
  import "../app.css";

  let { children }: { children: Snippet } = $props();
</script>

<ModeWatcher />
<Toaster />
{@render children()}
```

### App Layout (`(app)/+layout.svelte`)

Renders the navigation shell. All board and settings pages inherit this layout.

### Board Layout (`(app)/boards/[boardId]/+layout.svelte`)

Optional board-scoped layout for persistent board header (board name, member avatars, filter controls) shared across the board view and its sub-pages (settings, card detail).

## Load Functions

Server load functions (`+page.server.ts`, `+layout.server.ts`) fetch data before rendering:

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
          },
        },
      },
    },
  });

  if (!board) throw error(404, "Board not found");

  return { board };
};
```

## Form Actions

Mutations use SvelteKit form actions, validated with sveltekit-superforms + Zod:

```typescript
// src/routes/(app)/boards/new/+page.server.ts
import type { Actions } from "./$types";
import { superValidate, fail } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { redirect } from "@sveltejs/kit";
import { createBoardSchema } from "$lib/schemas/board";
import { db } from "$lib/db";

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod4(createBoardSchema));
    if (!form.valid) return fail(400, { form });

    const board = await db.insert(boards).values(form.data).returning();
    throw redirect(303, `/boards/${board[0].id}`);
  },
};
```

## Navigation

Navigation uses standard `<a>` tags and SvelteKit's client-side routing. No manual router setup needed:

```svelte
<!-- Standard link — SvelteKit handles client-side navigation -->
<a href="/boards/{board.id}">
  {board.name}
</a>

<!-- Programmatic navigation -->
<script lang="ts">
  import { goto } from "$app/navigation";

  function handleCreate(boardId: string) {
    goto(`/boards/${boardId}`);
  }
</script>
```

### Active Route Detection

Use `$page` from `$app/stores` to highlight the active route:

```svelte
<script lang="ts">
  import { page } from "$app/stores";
</script>

<a
  href="/boards"
  class={$page.url.pathname.startsWith("/boards") ? "text-primary" : "text-muted-foreground"}
>
  Boards
</a>
```

## Dynamic Parameters

SvelteKit extracts params from directory names:

| Directory | Parameter | Access |
| --- | --- | --- |
| `[boardId]` | `boardId` | `params.boardId` in load functions |
| `[cardId]` | `cardId` | `params.cardId` in load functions |

Parameters are available in `+page.server.ts` load functions and form actions via the `params` object, and on the client via `$page.params`.

## Error Handling

- `+error.svelte` at the root catches unhandled errors and 404s.
- Load functions throw `error(404)` or `error(500)` for expected failures.
- Form actions return `fail(400, { form })` for validation errors.

## Redirects

Use `redirect()` from `@sveltejs/kit` in load functions or form actions:

```typescript
import { redirect } from "@sveltejs/kit";

// In a load function — redirect root to boards
export const load: PageServerLoad = async () => {
  throw redirect(303, "/boards");
};
```
