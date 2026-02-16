# Card Management

## Overview

Cards are the core unit of work. Each card represents a task, story, or work item that moves through the board's columns. Card operations use SvelteKit form actions for mutations, a dedicated route for the detail view, and Drizzle ORM for database access.

## Requirements

### Create Card
- User can create a card within any column
- Required fields: title
- Optional fields: description, due date, labels, assignee
- New cards are added to the top of the column by default

### Edit Card
- User can edit any field on a card
- Card opens in a detail view for editing
- Description supports rich text (bold, italic, lists, links)

### Delete Card
- User can delete a card
- Deletion requires confirmation via AlertDialog
- Deleted cards cannot be recovered

### Move Card
- User can drag a card to a different position within the same column
- User can drag a card to a different column
- Card position and column persist across sessions
- Moving a card to a new column represents a workflow state change

### Card Detail View
- Clicking a card opens a detail view overlay
- Detail view displays all card fields
- User can edit fields inline from the detail view
- User can close the detail view to return to the board

## Database Schema

The `cards` table in `src/lib/db/schema/cards.ts`:

```typescript
import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { columns } from "./columns";

export const cards = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  columnId: uuid("column_id").notNull().references(() => columns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Relations

```typescript
import { relations } from "drizzle-orm";
import { cards } from "./cards";
import { columns } from "./columns";
import { cardLabels } from "./card-labels";
import { comments } from "./comments";

export const cardsRelations = relations(cards, ({ one, many }) => ({
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  cardLabels: many(cardLabels),
  comments: many(comments),
}));
```

## Validation Schemas

Zod schemas in `src/lib/schemas/card.ts`:

```typescript
import { z } from "zod/v4";

export const createCardSchema = z.object({
  title: z.string().min(1, "Card title is required").max(500),
});

export const updateCardSchema = z.object({
  title: z.string().min(1, "Card title is required").max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
});

export const moveCardSchema = z.object({
  cardId: z.string().uuid(),
  targetColumnId: z.string().uuid(),
  position: z.coerce.number().int().min(0),
});

export const deleteCardSchema = z.object({
  cardId: z.string().uuid(),
});

export const reorderCardsSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1),
});
```

## Routes

| Route | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Card CRUD form actions (create, move, delete) |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | Load single card; update form action |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.svelte` | Card detail view |
| `src/routes/(app)/boards/[boardId]/cards/reorder/+server.ts` | JSON API endpoint for drag-and-drop reorder |

## Server Load Functions

### Card Detail Page

Loads a single card with its labels and comments for the detail view, plus the board's columns (for the MoveCardDialog):

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { updateCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";
import { columns } from "$lib/db/schema/columns";
import { eq, asc } from "drizzle-orm";

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

  const boardColumns = await db
    .select({ id: columns.id, name: columns.name })
    .from(columns)
    .where(eq(columns.boardId, params.boardId))
    .orderBy(asc(columns.position));

  const updateForm = await superValidate(
    { title: card.title, description: card.description ?? "" },
    zod4(updateCardSchema),
  );

  return { card, boardId: params.boardId, columns: boardColumns, updateForm };
};
```

## Form Actions

### Create Card

Creates a card at the top of a column (position 0), shifting existing cards down:

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts (actions — card-related)
import type { Actions } from "./$types";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { createCardSchema, moveCardSchema, deleteCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";
import { cards } from "$lib/db/schema/cards";
import { eq, sql } from "drizzle-orm";

export const actions: Actions = {
  createCard: async ({ request }) => {
    const form = await superValidate(request, zod4(createCardSchema));
    if (!form.valid) return fail(400, { form });

    const formData = await request.clone().formData();
    const columnId = formData.get("columnId") as string;

    await db.transaction(async (tx) => {
      // Shift existing cards down to make room at position 0
      await tx.update(cards)
        .set({ position: sql`${cards.position} + 1` })
        .where(eq(cards.columnId, columnId));

      await tx.insert(cards).values({
        columnId,
        title: form.data.title,
        position: 0,
      });
    });

    return { form };
  },

  moveCard: async ({ request }) => {
    const form = await superValidate(request, zod4(moveCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(cards)
      .set({
        columnId: form.data.targetColumnId,
        position: form.data.position,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, form.data.cardId));

    return { form };
  },

  deleteCard: async ({ request }) => {
    const form = await superValidate(request, zod4(deleteCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.delete(cards).where(eq(cards.id, form.data.cardId));

    return { form };
  },
};
```

### Update Card (Detail Page)

Updates card fields from the detail view:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (actions)
import type { Actions } from "./$types";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { updateCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";
import { cards } from "$lib/db/schema/cards";
import { eq } from "drizzle-orm";

export const actions: Actions = {
  update: async ({ request, params }) => {
    const form = await superValidate(request, zod4(updateCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(cards)
      .set({ ...form.data, updatedAt: new Date() })
      .where(eq(cards.id, params.cardId));

    return { form };
  },
};
```

### Reorder Cards (JSON API)

Drag-and-drop reordering within a column uses a JSON API endpoint:

```typescript
// src/routes/(app)/boards/[boardId]/cards/reorder/+server.ts
import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { cards } from "$lib/db/schema/cards";
import { eq } from "drizzle-orm";
import { reorderCardsSchema } from "$lib/schemas/card";

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const result = reorderCardsSchema.safeParse(body);

  if (!result.success) {
    throw error(400, "Invalid card order");
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < result.data.cardIds.length; i++) {
      await tx.update(cards)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(cards.id, result.data.cardIds[i]));
    }
  });

  return json({ ok: true });
};
```

## Component Patterns

### Card Item (Board View)

> **Status:** Implemented.

Compact card shown in column lists. Clicking opens the detail view. On hover, a three-dot actions menu appears in the top-right corner with "Move to" (opens `MoveCardDialog`) and "Delete" (opens `DeleteCardDialog`) options. The "Move to" option only appears when other columns exist. The menu trigger uses `stopPropagation()` to prevent navigating when clicking the dropdown.

Key implementation details:
- Wrapped in a `group/card` container `<div>` so the actions menu can show/hide on hover
- Title text has `pr-6` padding to avoid overlapping with the actions button
- Uses `DropdownMenu` from shadcn-svelte for the actions menu
- Actions menu stays visible when the dropdown is open (`menuOpen` state)

### Card Detail

> **Status:** Implemented.

Full card view with editable title, description, labels, comments, metadata, and delete. Uses shadcn Card components for section layout.

Key implementation details:
- Title is inline-editable: click the title to enter edit mode, press Enter or blur to save, Escape to cancel
- Uses a `titleSubmitting` guard flag to prevent double-submit when Enter triggers both `requestSubmit()` and a subsequent blur event (same pattern as `ColumnHeader` rename)
- Description is saved via a separate form with an explicit "Save" button
- Labels, metadata, and interactive comments (via `CommentList` component) are displayed in Card sections
- The Details card section includes a "Column" row showing the current column name and a "Move" button that opens `MoveCardDialog` (when other columns exist)
- Delete uses `DeleteCardDialog` in a danger zone section at the bottom
- `superForm`'s `onResult` resets the `titleSubmitting` flag and exits edit mode on success
- The card detail page server load function fetches the board's columns (ordered by position) alongside the card data, so `MoveCardDialog` has the column list it needs

### Move Card Dialog

> **Status:** Implemented.

Dialog for moving a card to another column via a dropdown picker. Provides a non-drag alternative for accessibility and quick moves.

Key implementation details:
- Uses `Dialog` (not `AlertDialog`) since this is a non-destructive action
- Shows current column name with an arrow pointing to the selected target column
- Uses `Select` component to pick the target column (current column excluded)
- Submits to the existing `?/moveCard` form action with position 0 (top of target column)
- Uses the hidden form + `requestSubmit()` pattern with `enhance` for progressive enhancement
- Tracks `moving` state to disable the button and show a spinner during submission
- Accessible from the `CardItem` dropdown menu ("Move to" option) and the `CardDetail` page (Details section "Move" button)
- `open` prop is bindable; selection resets when dialog closes

### Delete Card Dialog

> **Status:** Implemented.

AlertDialog confirmation for card deletion. Uses the hidden form + `requestSubmit()` pattern (same as board delete in settings page). Props take inline types `{ id: string; title: string }` rather than a `Card` type since `$lib/types` doesn't exist yet.

Key implementation details:
- Uses `AlertDialog.Action` with `onclick` to submit a hidden form (not a `<form>` inside the footer)
- Posts to `/boards/{boardId}?/deleteCard` with `cardId` hidden input
- Tracks `deleting` state to disable the button and show a spinner during submission
- Triggered from `CardItem`'s dropdown menu and the card detail view

### Add Card (Column Footer)

> **Status:** Implemented.

Inline form that expands in the column footer to create a new card. Uses `superForm` with `resetForm: true` to clear the input after submission. Destructures `submitting` to disable the submit button and show a spinner during submission.

## Toast Notifications

Card CRUD actions show toast notifications for user feedback:

| Action | Success Message | Error Message |
| --- | --- | --- |
| Add card | "Card added" | "Failed to add card" |
| Move card | "Card moved to \"{column}\"" | "Failed to move card" |
| Delete card | "Card deleted" | "Failed to delete card" |

`AddCard` uses `superForm`'s `onResult`. `DeleteCardDialog` uses SvelteKit's `enhance` from `$app/forms`.

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/cards.ts` | Card database schema and relations |
| `src/lib/schemas/card.ts` | Zod validation schemas for card forms |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Card CRUD form actions (create, move, delete) |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | Load card detail; update action |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.svelte` | Card detail page |
| `src/routes/(app)/boards/[boardId]/cards/reorder/+server.ts` | JSON API for drag-and-drop reorder |
| `src/lib/components/card/CardItem.svelte` | Compact card in board column view |
| `src/lib/components/card/CardDetail.svelte` | Full card detail with editable fields |
| `src/lib/components/card/MoveCardDialog.svelte` | Move card to another column dialog |
| `src/lib/components/card/DeleteCardDialog.svelte` | Delete confirmation dialog |
| `src/lib/components/card/AddCard.svelte` | Inline form to create a new card |
