# Frontend State And Data

## Overview

State management uses Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactive client-side state and SvelteKit load functions for server data. There are no external state management libraries — no Zustand, no React Query, no context providers. Data flows from server load functions into components via page data, and local UI state lives in runes or shared stores.

## State Primitives

All reactive state uses Svelte 5 runes. No `writable()` / `readable()` stores from Svelte 4.

| Rune | Purpose |
| --- | --- |
| `$state()` | Local mutable state within a component |
| `$derived()` | Computed values that auto-update when dependencies change |
| `$effect()` | Side effects triggered by state changes |
| `$props()` | Component input — replaces `export let` |

### Component-Local State

```svelte
<script lang="ts">
  let editing = $state(false);
  let filterText = $state("");
  let selectedLabels = $state<string[]>([]);

  // Derived values auto-track dependencies
  let hasActiveFilters = $derived(filterText.length > 0 || selectedLabels.length > 0);
</script>
```

## Shared Stores

For state that spans multiple components (UI preferences, theme, active filters), use module-level `$state` in `.svelte.ts` files under `src/lib/stores/`.

```typescript
// src/lib/stores/ui-preferences.svelte.ts
let sidebarCollapsed = $state(false);
let cardDensity = $state<"compact" | "default" | "comfortable">("default");

export function getUiPreferences() {
  return {
    get sidebarCollapsed() { return sidebarCollapsed; },
    set sidebarCollapsed(value: boolean) { sidebarCollapsed = value; },
    get cardDensity() { return cardDensity; },
    set cardDensity(value: "compact" | "default" | "comfortable") { cardDensity = value; },
    toggleSidebar() { sidebarCollapsed = !sidebarCollapsed; },
  };
}
```

```svelte
<script lang="ts">
  import { getUiPreferences } from "$lib/stores/ui-preferences.svelte";

  const ui = getUiPreferences();
</script>

<button onclick={() => ui.toggleSidebar()}>
  {ui.sidebarCollapsed ? "Expand" : "Collapse"}
</button>
```

### Store Inventory

| Store | File | Purpose |
| --- | --- | --- |
| `getUiPreferences` | `src/lib/stores/ui-preferences.svelte.ts` | Sidebar state, card density, view toggles |
| `getBoardFilters` | `src/lib/stores/board-filters.svelte.ts` | Active search text, label filters, assignee filters |
| `getDragState` | `src/lib/stores/drag-state.svelte.ts` | Drag-and-drop source, target, and active card |

## Server Data — Load Functions

SvelteKit load functions are the primary data source. Data is fetched on the server in `+page.server.ts` / `+layout.server.ts` and passed to components as page data.

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
            with: {
              cardLabels: { with: { label: true } },
              comments: { columns: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!board) throw error(404, "Board not found");

  const createColumnForm = await superValidate(zod4(createColumnSchema));
  const createCardForm = await superValidate(zod4(createCardSchema));

  return { board, createColumnForm, createCardForm };
};
```

### Accessing Page Data

Components receive server data through the `data` prop from `+page.svelte`:

```svelte
<!-- src/routes/(app)/boards/[boardId]/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import BoardView from "$lib/components/board/BoardView.svelte";

  let { data }: { data: PageData } = $props();
</script>

<BoardView board={data.board} />
```

### Layout Data

Shared data (user session, theme preference) loads in layout server files and is available to all child routes:

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  const theme = cookies.get("theme") ?? "system";
  return { theme };
};
```

## Mutations — Form Actions

All data mutations use SvelteKit form actions, validated with sveltekit-superforms + Zod. No client-side API calls for mutations.

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts
import type { Actions } from "./$types";
import { superValidate, fail } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { moveCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";

export const actions: Actions = {
  moveCard: async ({ request }) => {
    const form = await superValidate(request, zod4(moveCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(cards)
      .set({ columnId: form.data.targetColumnId, position: form.data.position })
      .where(eq(cards.id, form.data.cardId));

    return { form };
  },
};
```

### Submitting Actions From Components

Use `enhance` from sveltekit-superforms for progressive enhancement:

```svelte
<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const { form, enhance } = superForm(data.moveCardForm);
</script>

<form method="POST" action="?/moveCard" use:enhance>
  <input type="hidden" name="cardId" value={card.id} />
  <input type="hidden" name="targetColumnId" value={targetColumn.id} />
  <button type="submit">Move</button>
</form>
```

## Reactive Derived Data

Use `$derived` for computed values that depend on server data or local state:

```svelte
<script lang="ts">
  import type { PageData } from "./$types";
  import { getBoardFilters } from "$lib/stores/board-filters.svelte";

  let { data }: { data: PageData } = $props();

  const filters = getBoardFilters();

  let filteredCards = $derived(
    data.board.columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        if (filters.searchText && !card.title.toLowerCase().includes(filters.searchText.toLowerCase())) {
          return false;
        }
        if (filters.labelIds.length > 0 && !card.labels.some((l) => filters.labelIds.includes(l.id))) {
          return false;
        }
        return true;
      }),
    }))
  );
</script>
```

## Data Invalidation

After a form action completes, SvelteKit automatically re-runs load functions for the current page, keeping displayed data fresh. For cases where you need manual invalidation:

```svelte
<script lang="ts">
  import { invalidate, invalidateAll } from "$app/navigation";

  // Re-run a specific load function by its URL dependency
  await invalidate("/api/boards");

  // Re-run all load functions for the current page
  await invalidateAll();
</script>
```

## Error State

Errors from load functions are caught by `+error.svelte` boundaries. Form validation errors are returned inline via `fail()` and displayed using formsnap:

```svelte
<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { superForm } from "sveltekit-superforms";

  let { data } = $props();
  const { form, errors, enhance } = superForm(data.createCardForm);
</script>

<form method="POST" use:enhance>
  <Form.Field {form} name="title">
    <Form.Control let:attrs>
      <input {...attrs} bind:value={$form.title} />
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</form>
```

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/stores/` | Shared `.svelte.ts` rune stores |
| `src/lib/stores/ui-preferences.svelte.ts` | UI preferences (sidebar, density, toggles) |
| `src/lib/stores/board-filters.svelte.ts` | Board filter state (search, labels, assignees) |
| `src/lib/stores/drag-state.svelte.ts` | Drag-and-drop state |
| `src/routes/**/+page.server.ts` | Server load functions and form actions |
| `src/routes/**/+layout.server.ts` | Shared layout data (session, theme) |
| `src/lib/schemas/` | Zod validation schemas for form actions |
| `src/lib/db/` | Drizzle ORM database client and queries |
