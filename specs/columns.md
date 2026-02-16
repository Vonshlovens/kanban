# Column Management

## Overview

Columns represent workflow stages within a board. Cards move through columns to reflect progress. Column operations use SvelteKit form actions for mutations, a JSON API endpoint for reordering, and Drizzle ORM for database access.

## Requirements

### Create Column
- User can add new columns to a board
- Columns require a name
- New columns are appended to the end of the board by default

### Edit Column
- User can rename a column
- Name changes are reflected immediately

### Delete Column
- User can delete a column
- If the column contains cards, user must choose to either move them to another column or delete them
- Deletion requires confirmation

### Reorder Columns
- User can drag columns to reorder them within a board
- Column order persists across sessions

### Work-in-Progress (WIP) Limits
- User can set a maximum card count per column
- When a column reaches its WIP limit, a visual indicator is shown
- WIP limits are advisory — users can still add cards beyond the limit, but the column is flagged

## Database Schema

The `columns` table in `src/lib/db/schema/columns.ts`:

```typescript
import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { boards } from "./boards";

export const columns = pgTable("columns", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  wipLimit: integer("wip_limit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Relations

```typescript
import { relations } from "drizzle-orm";
import { columns } from "./columns";
import { boards } from "./boards";
import { cards } from "./cards";

export const columnsRelations = relations(columns, ({ one, many }) => ({
  board: one(boards, { fields: [columns.boardId], references: [boards.id] }),
  cards: many(cards),
}));
```

## Validation Schemas

Zod schemas in `src/lib/schemas/column.ts`:

```typescript
import { z } from "zod/v4";

export const createColumnSchema = z.object({
  name: z.string().min(1, "Column name is required").max(100),
});

export const renameColumnSchema = z.object({
  name: z.string().min(1, "Column name is required").max(100),
});

export const updateWipLimitSchema = z.object({
  wipLimit: z.coerce.number().int().min(0).nullable(),
});

export const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string().uuid()).min(1),
});

export const deleteColumnSchema = z.object({
  moveCardsTo: z.string().uuid().optional(),
});
```

## Routes

| Route | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Load board with columns; column CRUD form actions |
| `src/routes/(app)/boards/[boardId]/columns/reorder/+server.ts` | JSON API endpoint for drag-and-drop reorder |

## Server Load Functions

### Board Page (loads columns)

Columns are loaded as part of the board page, not as a separate route:

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { createColumnSchema } from "$lib/schemas/column";
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

  const createColumnForm = await superValidate(zod4(createColumnSchema));

  return { board, createColumnForm };
};
```

## Form Actions

### Create Column

Appends a new column at the end of the board:

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts (actions)
import type { Actions } from "./$types";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { createColumnSchema, renameColumnSchema, updateWipLimitSchema, deleteColumnSchema } from "$lib/schemas/column";
import { db } from "$lib/db";
import { columns } from "$lib/db/schema/columns";
import { cards } from "$lib/db/schema/cards";
import { eq, and, max } from "drizzle-orm";

export const actions: Actions = {
  createColumn: async ({ request, params }) => {
    const form = await superValidate(request, zod4(createColumnSchema));
    if (!form.valid) return fail(400, { form });

    const [maxPos] = await db
      .select({ value: max(columns.position) })
      .from(columns)
      .where(eq(columns.boardId, params.boardId));

    await db.insert(columns).values({
      boardId: params.boardId,
      name: form.data.name,
      position: (maxPos.value ?? -1) + 1,
    });

    return { form };
  },

  renameColumn: async ({ request, params }) => {
    const form = await superValidate(request, zod4(renameColumnSchema));
    if (!form.valid) return fail(400, { form });

    const formData = await request.clone().formData();
    const columnId = formData.get("columnId") as string;

    await db.update(columns)
      .set({ name: form.data.name, updatedAt: new Date() })
      .where(and(eq(columns.id, columnId), eq(columns.boardId, params.boardId)));

    return { form };
  },

  updateWipLimit: async ({ request, params }) => {
    const form = await superValidate(request, zod4(updateWipLimitSchema));
    if (!form.valid) return fail(400, { form });

    const formData = await request.clone().formData();
    const columnId = formData.get("columnId") as string;

    await db.update(columns)
      .set({ wipLimit: form.data.wipLimit, updatedAt: new Date() })
      .where(and(eq(columns.id, columnId), eq(columns.boardId, params.boardId)));

    return { form };
  },

  deleteColumn: async ({ request, params }) => {
    const form = await superValidate(request, zod4(deleteColumnSchema));
    if (!form.valid) return fail(400, { form });

    const formData = await request.clone().formData();
    const columnId = formData.get("columnId") as string;

    await db.transaction(async (tx) => {
      if (form.data.moveCardsTo) {
        await tx.update(cards)
          .set({ columnId: form.data.moveCardsTo })
          .where(eq(cards.columnId, columnId));
      } else {
        await tx.delete(cards).where(eq(cards.columnId, columnId));
      }

      await tx.delete(columns)
        .where(and(eq(columns.id, columnId), eq(columns.boardId, params.boardId)));
    });

    return { form };
  },
};
```

### Reorder Columns (JSON API)

Drag-and-drop reordering uses a JSON API endpoint instead of a form action, since it's triggered programmatically:

```typescript
// src/routes/(app)/boards/[boardId]/columns/reorder/+server.ts
import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { columns } from "$lib/db/schema/columns";
import { eq, and } from "drizzle-orm";
import { reorderColumnsSchema } from "$lib/schemas/column";

export const PUT: RequestHandler = async ({ request, params }) => {
  const body = await request.json();
  const result = reorderColumnsSchema.safeParse(body);

  if (!result.success) {
    throw error(400, "Invalid column order");
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < result.data.columnIds.length; i++) {
      await tx.update(columns)
        .set({ position: i, updatedAt: new Date() })
        .where(and(eq(columns.id, result.data.columnIds[i]), eq(columns.boardId, params.boardId)));
    }
  });

  return json({ ok: true });
};
```

## Component Patterns

### Column Component

```svelte
<!-- src/lib/components/column/Column.svelte -->
<script lang="ts">
  import type { Column, Card } from "$lib/types";
  import ColumnHeader from "./ColumnHeader.svelte";
  import ColumnFooter from "./ColumnFooter.svelte";
  import CardItem from "$lib/components/card/CardItem.svelte";

  let { column, cards }: { column: Column; cards: Card[] } = $props();

  let isOverWipLimit = $derived(
    column.wipLimit != null && cards.length > column.wipLimit
  );
  let isAtWipLimit = $derived(
    column.wipLimit != null && cards.length === column.wipLimit
  );
</script>

<div
  class="flex h-full w-80 shrink-0 flex-col rounded-xl bg-neutral-100 dark:bg-neutral-900"
  class:ring-2={isOverWipLimit}
  class:ring-amber-500={isOverWipLimit}
>
  <ColumnHeader {column} cardCount={cards.length} />

  <div class="flex-1 space-y-2 overflow-y-auto p-2">
    {#each cards as card (card.id)}
      <CardItem {card} />
    {/each}
  </div>

  <ColumnFooter {column} {isAtWipLimit} {isOverWipLimit} />
</div>
```

### Column Header

```svelte
<!-- src/lib/components/column/ColumnHeader.svelte -->
<!-- NOTE: DropdownMenu requires the dropdown-menu shadcn-svelte component to be installed -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import MoreHorizontalIcon from "@lucide/svelte/icons/more-horizontal";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { cn } from "$lib/utils";

  let { column, cardCount }: {
    column: { id: string; name: string; wipLimit?: number | null };
    cardCount: number;
  } = $props();

  let editing = $state(false);
  let editName = $state(column.name);
</script>

<div class="flex items-center gap-1.5 px-3 pt-3 pb-2">
  <GripVerticalIcon class="size-3.5 shrink-0 cursor-grab text-muted-foreground/50" />

  {#if editing}
    <form method="POST" action="?/renameColumn" class="flex-1">
      <input type="hidden" name="columnId" value={column.id} />
      <Input
        name="name"
        bind:value={editName}
        class="h-6 border-none bg-transparent px-0 text-sm font-semibold shadow-none"
        onblur={() => { editing = false; editName = column.name; }}
        autofocus
      />
    </form>
  {:else}
    <button
      class="flex-1 truncate text-left text-sm font-semibold text-foreground"
      ondblclick={() => editing = true}
      title="Double-click to rename"
    >
      {column.name}
    </button>
  {/if}

  <span class={cn(
    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none",
    column.wipLimit != null && cardCount > column.wipLimit
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
      : "bg-muted text-muted-foreground"
  )}>
    {cardCount}{#if column.wipLimit != null}<span class="opacity-50">/{column.wipLimit}</span>{/if}
  </span>

  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button variant="ghost" size="icon-sm" class="size-7" {...props}>
          <MoreHorizontalIcon class="size-4" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end">
      <DropdownMenu.Item onclick={() => editing = true}>Rename</DropdownMenu.Item>
      <DropdownMenu.Item>Set WIP Limit</DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item class="text-destructive">Delete Column</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
```

### Column Footer

```svelte
<!-- src/lib/components/column/ColumnFooter.svelte -->
<!-- NOTE: ColumnFooter was merged into Column.svelte — WIP warning is inline, AddCard handles the button -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import PlusIcon from "@lucide/svelte/icons/plus";

  let { column, isAtWipLimit, isOverWipLimit }: {
    column: Column;
    isAtWipLimit: boolean;
    isOverWipLimit: boolean;
  } = $props();
</script>

<div class="p-2">
  {#if isOverWipLimit}
    <p class="mb-2 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
      Over WIP limit ({column.wipLimit})
    </p>
  {/if}

  <Button variant="ghost" class="w-full justify-start text-neutral-500" size="sm">
    <Plus class="mr-2 h-4 w-4" />
    Add Card
  </Button>
</div>
```

### Add Column

```svelte
<!-- src/lib/components/column/AddColumn.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { superForm } from "sveltekit-superforms";
  import type { SuperValidated, Infer } from "sveltekit-superforms";
  import type { createColumnSchema } from "$lib/schemas/column";

  let { form: formData }: { form: SuperValidated<CreateColumnSchema> } = $props();

  const { form, enhance } = superForm(formData, {
    resetForm: true,
    onResult: () => { adding = false; },
  });

  let adding = $state(false);
</script>

{#if adding}
  <form method="POST" action="?/createColumn" use:enhance class="w-80 shrink-0 space-y-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-900">
    <Input name="name" bind:value={$form.name} placeholder="Column name" autofocus />
    <div class="flex gap-2">
      <Button type="submit" size="sm">Add Column</Button>
      <Button variant="ghost" size="sm" onclick={() => adding = false}>
        <X class="h-4 w-4" />
      </Button>
    </div>
  </form>
{:else}
  <Button
    variant="ghost"
    class="w-80 shrink-0 justify-start text-neutral-500"
    onclick={() => adding = true}
  >
    <Plus class="mr-2 h-4 w-4" />
    Add Column
  </Button>
{/if}
```

### Delete Column Dialog

```svelte
<!-- src/lib/components/column/DeleteColumnDialog.svelte -->
<script lang="ts">
  import type { Column } from "$lib/types";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";

  let { column, otherColumns, open = $bindable(false) }: {
    column: Column;
    otherColumns: Column[];
    open: boolean;
  } = $props();

  let moveCardsTo = $state<string | undefined>(undefined);
  let hasCards = $derived(column.cardCount > 0);
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete "{column.name}"?</AlertDialog.Title>
      <AlertDialog.Description>
        {#if hasCards}
          This column has {column.cardCount} card{column.cardCount === 1 ? "" : "s"}. Choose what to do with them.
        {:else}
          This column is empty and will be permanently deleted.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>

    {#if hasCards && otherColumns.length > 0}
      <div class="space-y-3 py-2">
        <Select.Root type="single" onValueChange={(v) => moveCardsTo = v}>
          <Select.Trigger placeholder="Move cards to...">
          </Select.Trigger>
          <Select.Content>
            {#each otherColumns as col}
              <Select.Item value={col.id}>{col.name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <p class="text-xs text-neutral-500">
          Or leave empty to delete all cards in this column.
        </p>
      </div>
    {/if}

    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <form method="POST" action="?/deleteColumn">
        <input type="hidden" name="columnId" value={column.id} />
        {#if moveCardsTo}
          <input type="hidden" name="moveCardsTo" value={moveCardsTo} />
        {/if}
        <Button type="submit" variant="destructive">Delete</Button>
      </form>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/columns.ts` | Column database schema and relations |
| `src/lib/schemas/column.ts` | Zod validation schemas for column forms |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Load board with columns; column CRUD form actions |
| `src/routes/(app)/boards/[boardId]/columns/reorder/+server.ts` | JSON API for drag-and-drop reorder |
| `src/lib/components/column/Column.svelte` | Main column container with WIP limit state |
| `src/lib/components/column/ColumnHeader.svelte` | Header with name, inline rename, action menu |
| `src/lib/components/column/ColumnFooter.svelte` | Footer with WIP indicator and add card button |
| `src/lib/components/column/AddColumn.svelte` | Inline form to create a new column |
| `src/lib/components/column/DeleteColumnDialog.svelte` | Delete confirmation with card migration option |
