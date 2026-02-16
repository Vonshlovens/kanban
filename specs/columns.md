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
  wipLimit: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" || v === 0 ? null : v)),
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

> **Status:** All column CRUD components are implemented. The code below reflects the actual implementation. There is no separate `ColumnFooter` component — the WIP warning and AddCard button are inline in `Column.svelte`.

### Column Component

`Column.svelte` receives a column (with nested cards), `boardId`, `otherColumns` (sibling columns for delete migration), and the `createCardForm`. It computes WIP limit state and delegates to `ColumnHeader` and `AddCard`.

Key props:
- `column` — full column object with nested `cards` array
- `otherColumns` — `{ id, name }[]` of sibling columns (for card migration in delete dialog)
- `boardId` — used for card links and form action URLs
- `createCardForm` — supervalidated form for the AddCard component

### Column Header

`ColumnHeader.svelte` includes:
- Drag handle (grip icon, visible on column hover)
- Inline rename via double-click (Enter submits to `?/renameColumn`, Escape cancels)
- Card count badge with WIP limit display (e.g., `5/8`)
- Three-dot dropdown menu (visible on hover) with:
  - **Rename** — triggers inline editing
  - **Set WIP limit** — opens an inline panel with +/- stepper and number input; posts to `?/updateWipLimit` via hidden form. Setting to 0 removes the limit (sends empty string → null).
  - **Delete column** — opens `DeleteColumnDialog`

The dropdown uses the `{#snippet child({ props })}` pattern on `DropdownMenu.Trigger`. The WIP limit panel appears below the header inside the column (not in a popover) for a grounded, inline editing feel.

### Add Column

`AddColumn.svelte` toggles between a ghost button and an inline form. Uses `superForm` with `resetForm: true` and `onResult` to auto-close.

### Delete Column Dialog

`DeleteColumnDialog.svelte` uses AlertDialog with:
- `cardCount` prop to show how many cards are affected
- If cards exist and other columns available: shows a Select picker for migration target
- If cards exist but no other columns: shows a destructive warning
- If empty: simple confirmation message
- Hidden form posts to `/boards/{boardId}?/deleteColumn` with `columnId` and optional `moveCardsTo`

### Validation Schemas

The `updateWipLimitSchema` uses a union type to handle the empty-string-to-null conversion:
```typescript
export const updateWipLimitSchema = z.object({
  wipLimit: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" || v === 0 ? null : v)),
});
```

## Toast Notifications

All column CRUD actions show toast notifications for user feedback:

| Action | Success Message | Error Message |
| --- | --- | --- |
| Add column | "Column added" | "Failed to add column" |
| Rename column | "Column renamed" | "Failed to rename column" |
| Update WIP limit | "WIP limit updated" / "WIP limit removed" | "Failed to update WIP limit" |
| Delete column | "Column \"{name}\" deleted" | "Failed to delete column" |

`AddColumn` uses `superForm`'s `onResult`. `ColumnHeader` rename and WIP forms use SvelteKit's `enhance`. `DeleteColumnDialog` uses SvelteKit's `enhance`.

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/columns.ts` | Column database schema and relations |
| `src/lib/schemas/column.ts` | Zod validation schemas for column forms |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Load board with columns; column CRUD form actions |
| `src/routes/(app)/boards/[boardId]/columns/reorder/+server.ts` | JSON API for drag-and-drop reorder (not yet implemented) |
| `src/lib/components/column/Column.svelte` | Main column container with WIP limit state |
| `src/lib/components/column/ColumnHeader.svelte` | Header with name, inline rename, dropdown menu, WIP limit panel |
| `src/lib/components/column/AddColumn.svelte` | Inline form to create a new column |
| `src/lib/components/column/DeleteColumnDialog.svelte` | Delete confirmation with card migration option |
