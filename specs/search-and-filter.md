# Search and Filter

## Overview

Users can locate and narrow down visible cards using search and filtering controls. All search and filter state lives client-side as Svelte 5 runes — no server round-trips needed. The board page load function already returns the full card graph (with labels, assignee, due date), so filtering is a matter of derived state over the existing data. A `SearchFilterBar` component above the board columns holds the search input and filter controls.

## Requirements

### Search
- User can search cards by title and description text
- Search is performed within the current board
- Results are filtered in real-time as the user types (client-side, no server call)
- Clearing the search restores the full board view
- Search is case-insensitive

### Filter by Assignee
- User can filter cards to show only those assigned to a specific user
- "Unassigned" is a valid filter option
- Single-select: only one assignee filter active at a time

### Filter by Label — Implemented (standalone)
- User can filter cards by one or more labels
- Multiple label filters use OR logic (show cards matching **any** selected label)
- Currently implemented as a standalone `LabelFilterBar` component in the board page (see `specs/labels.md`). When the full `SearchFilterBar` is built, label filtering should be migrated into the unified filter store.

### Filter by Due Date
- User can filter cards by due date status: overdue, due today, due this week, no due date
- Single-select: only one due date filter active at a time
- Status is computed client-side using the `getDueStatus` helper from `$lib/utils/due-date`

### Combined Filters
- Multiple filter types can be active simultaneously (AND logic across types)
- Active filters are displayed clearly and can be individually cleared
- A "clear all filters" action resets the board to its unfiltered state

## No New Database Schema

Search and filter is entirely client-side. The board page load function (see `specs/cards.md`, `specs/labels.md`) already returns all cards with their relations:

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts (load — already exists)
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
            assignee: true,
          },
        },
      },
    },
    labels: true,
  },
});
```

No new tables, columns, routes, or form actions are needed.

## Filter State

All filter state is managed in a single reactive object, defined in the board page or a dedicated store. This makes it easy to clear all filters and pass state to child components:

```typescript
// src/lib/stores/board-filters.ts
import { getDueStatus, type DueStatus } from "$lib/utils/due-date";

export type DueDateFilter = "overdue" | "due-today" | "due-this-week" | "no-due-date" | null;

export interface BoardFilters {
  searchQuery: string;
  assigneeId: string | "unassigned" | null;
  labelIds: Set<string>;
  dueDateFilter: DueDateFilter;
}

export function createBoardFilters() {
  let searchQuery = $state("");
  let assigneeId = $state<string | "unassigned" | null>(null);
  let labelIds = $state<Set<string>>(new Set());
  let dueDateFilter = $state<DueDateFilter>(null);

  let hasActiveFilters = $derived(
    searchQuery.length > 0 ||
    assigneeId !== null ||
    labelIds.size > 0 ||
    dueDateFilter !== null,
  );

  function clearAll() {
    searchQuery = "";
    assigneeId = null;
    labelIds = new Set();
    dueDateFilter = null;
  }

  function toggleLabel(id: string) {
    if (labelIds.has(id)) {
      labelIds.delete(id);
    } else {
      labelIds.add(id);
    }
    labelIds = new Set(labelIds); // trigger reactivity
  }

  return {
    get searchQuery() { return searchQuery; },
    set searchQuery(v: string) { searchQuery = v; },
    get assigneeId() { return assigneeId; },
    set assigneeId(v: string | "unassigned" | null) { assigneeId = v; },
    get labelIds() { return labelIds; },
    get dueDateFilter() { return dueDateFilter; },
    set dueDateFilter(v: DueDateFilter) { dueDateFilter = v; },
    get hasActiveFilters() { return hasActiveFilters; },
    clearAll,
    toggleLabel,
  };
}
```

## Filter Logic

A pure function that takes a card array and the current filters, returning the subset that matches. Each filter type is applied independently (AND across types):

```typescript
// src/lib/utils/filter-cards.ts
import type { BoardFilters, DueDateFilter } from "$lib/stores/board-filters";
import { getDueStatus } from "$lib/utils/due-date";

interface FilterableCard {
  title: string;
  description: string | null;
  dueDate: Date | string | null;
  assigneeId: string | null;
  cardLabels: Array<{ labelId: string }>;
}

export function filterCards<T extends FilterableCard>(
  cards: T[],
  filters: BoardFilters,
): T[] {
  return cards.filter((card) => {
    // Text search — case-insensitive match on title and description
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const titleMatch = card.title.toLowerCase().includes(q);
      const descMatch = card.description?.toLowerCase().includes(q) ?? false;
      if (!titleMatch && !descMatch) return false;
    }

    // Assignee filter
    if (filters.assigneeId !== null) {
      if (filters.assigneeId === "unassigned") {
        if (card.assigneeId !== null) return false;
      } else {
        if (card.assigneeId !== filters.assigneeId) return false;
      }
    }

    // Label filter — OR logic: card must have at least one of the selected labels
    if (filters.labelIds.size > 0) {
      const hasMatch = card.cardLabels.some((cl) => filters.labelIds.has(cl.labelId));
      if (!hasMatch) return false;
    }

    // Due date filter
    if (filters.dueDateFilter !== null) {
      if (!matchesDueDateFilter(card.dueDate, filters.dueDateFilter)) return false;
    }

    return true;
  });
}

function matchesDueDateFilter(
  dueDate: Date | string | null,
  filter: DueDateFilter,
): boolean {
  if (filter === "no-due-date") return dueDate === null;
  if (!dueDate) return false;

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();

  switch (filter) {
    case "overdue":
      return due.getTime() < now.getTime();
    case "due-today": {
      return (
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate()
      );
    }
    case "due-this-week": {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return due >= startOfWeek && due < endOfWeek;
    }
    default:
      return false;
  }
}
```

## Component Patterns

### SearchFilterBar

The main container for all search and filter controls. Sits above the board columns:

```svelte
<!-- src/lib/components/board/SearchFilterBar.svelte -->
<script lang="ts">
  import { Search, X, Filter } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Popover from "$lib/components/ui/popover";
  import { cn } from "$lib/utils";
  import type { createBoardFilters } from "$lib/stores/board-filters";

  let { filters, boardLabels, boardMembers }: {
    filters: ReturnType<typeof createBoardFilters>;
    boardLabels: Array<{ id: string; name: string; color: string }>;
    boardMembers: Array<{ id: string; name: string; avatarUrl: string | null }>;
  } = $props();
</script>

<div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800">
  <!-- Search input -->
  <div class="relative flex-1 min-w-48 max-w-sm">
    <Search class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
    <Input
      type="text"
      placeholder="Search cards..."
      class="h-8 pl-8 pr-8"
      bind:value={filters.searchQuery}
    />
    {#if filters.searchQuery}
      <button
        class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
        onclick={() => filters.searchQuery = ""}
      >
        <X class="h-3.5 w-3.5" />
      </button>
    {/if}
  </div>

  <!-- Label filter toggles -->
  {#each boardLabels as label}
    <button
      class={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        filters.labelIds.has(label.id)
          ? "ring-2 ring-offset-1 ring-neutral-400 dark:ring-neutral-500"
          : "opacity-60 hover:opacity-100",
      )}
      style="background-color: {label.color}; color: white"
      onclick={() => filters.toggleLabel(label.id)}
    >
      {label.name}
    </button>
  {/each}

  <!-- Assignee filter -->
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
      <Button variant="outline" size="sm" {...props} class={cn("h-8", filters.assigneeId && "ring-2 ring-neutral-400")}>
        <Filter class="mr-1.5 h-3.5 w-3.5" />
        {#if filters.assigneeId === "unassigned"}
          Unassigned
        {:else if filters.assigneeId}
          Assignee
        {:else}
          Assignee
        {/if}
      </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-48 p-1" align="start">
      <button
        class={cn("w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800", filters.assigneeId === "unassigned" && "bg-neutral-100 dark:bg-neutral-800")}
        onclick={() => filters.assigneeId = filters.assigneeId === "unassigned" ? null : "unassigned"}
      >
        Unassigned
      </button>
      {#each boardMembers as member}
        <button
          class={cn("w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800", filters.assigneeId === member.id && "bg-neutral-100 dark:bg-neutral-800")}
          onclick={() => filters.assigneeId = filters.assigneeId === member.id ? null : member.id}
        >
          {member.name}
        </button>
      {/each}
    </Popover.Content>
  </Popover.Root>

  <!-- Due date filter -->
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
      <Button variant="outline" size="sm" {...props} class={cn("h-8", filters.dueDateFilter && "ring-2 ring-neutral-400")}>
        Due date
      </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-44 p-1" align="start">
      {#each [
        { value: "overdue", label: "Overdue" },
        { value: "due-today", label: "Due today" },
        { value: "due-this-week", label: "Due this week" },
        { value: "no-due-date", label: "No due date" },
      ] as opt}
        <button
          class={cn("w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800", filters.dueDateFilter === opt.value && "bg-neutral-100 dark:bg-neutral-800")}
          onclick={() => filters.dueDateFilter = filters.dueDateFilter === opt.value ? null : opt.value}
        >
          {opt.label}
        </button>
      {/each}
    </Popover.Content>
  </Popover.Root>

  <!-- Clear all -->
  {#if filters.hasActiveFilters}
    <Button variant="ghost" size="sm" class="h-8 text-xs text-neutral-500" onclick={() => filters.clearAll()}>
      <X class="mr-1 h-3 w-3" />
      Clear all
    </Button>
  {/if}
</div>
```

### Board Page Integration

The board page creates the filter store and applies `filterCards` to each column's card list via `$derived`:

```svelte
<!-- src/routes/(app)/boards/[boardId]/+page.svelte -->
<script lang="ts">
  import SearchFilterBar from "$lib/components/board/SearchFilterBar.svelte";
  import { createBoardFilters } from "$lib/stores/board-filters";
  import { filterCards } from "$lib/utils/filter-cards";

  let { data } = $props();

  let filters = createBoardFilters();

  // Each column's cards are filtered through the shared filter state
  let filteredColumns = $derived(
    data.board.columns.map((col) => ({
      ...col,
      cards: filterCards(col.cards, filters),
    })),
  );
</script>

<SearchFilterBar
  {filters}
  boardLabels={data.board.labels}
  boardMembers={data.boardMembers ?? []}
/>

<!-- Render filteredColumns instead of data.board.columns -->
{#each filteredColumns as column}
  <!-- ... existing column rendering ... -->
{/each}
```

### Active Filter Chips (Optional Enhancement)

Active filters can be shown as removable chips between the filter bar and the columns for quick visibility:

```svelte
<!-- Inside SearchFilterBar or a separate ActiveFilters component -->
{#if filters.hasActiveFilters}
  <div class="flex flex-wrap items-center gap-1.5 px-4 py-1.5">
    {#if filters.searchQuery}
      <span class="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
        Search: "{filters.searchQuery}"
        <button onclick={() => filters.searchQuery = ""}><X class="h-3 w-3" /></button>
      </span>
    {/if}
    {#if filters.assigneeId}
      <span class="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
        {filters.assigneeId === "unassigned" ? "Unassigned" : "Assignee"}
        <button onclick={() => filters.assigneeId = null}><X class="h-3 w-3" /></button>
      </span>
    {/if}
    {#if filters.dueDateFilter}
      <span class="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
        {filters.dueDateFilter}
        <button onclick={() => filters.dueDateFilter = null}><X class="h-3 w-3" /></button>
      </span>
    {/if}
  </div>
{/if}
```

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/stores/board-filters.ts` | Reactive filter state factory using Svelte 5 runes |
| `src/lib/utils/filter-cards.ts` | Pure filter function — text search, assignee, label, due date |
| `src/lib/components/board/SearchFilterBar.svelte` | Search input + filter controls above the board |
| `src/routes/(app)/boards/[boardId]/+page.svelte` | Creates filter store, applies `filterCards` to column cards |
| `src/lib/utils/due-date.ts` | Existing `getDueStatus` helper reused for due date filtering |
