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

Loads a single card with its labels and comments for the detail view:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { updateCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";

export const load: PageServerLoad = async ({ params }) => {
  const card = await db.query.cards.findFirst({
    where: (cards, { eq }) => eq(cards.id, params.cardId),
    with: {
      cardLabels: { with: { label: true } },
      comments: {
        orderBy: (comments, { desc }) => [desc(comments.createdAt)],
      },
    },
  });

  if (!card) throw error(404, "Card not found");

  const updateForm = await superValidate(card, zod4(updateCardSchema));

  return { card, boardId: params.boardId, updateForm };
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

Compact card shown in column lists. Clicking opens the detail view.

```svelte
<!-- src/lib/components/card/CardItem.svelte -->
<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import AlignLeftIcon from "@lucide/svelte/icons/align-left";
  import { cn } from "$lib/utils";

  let { card, boardId }: { card: any; boardId: string } = $props();

  let hasDescription = $derived(!!card.description);
  let labelCount = $derived(card.cardLabels?.length ?? 0);
  let commentCount = $derived(card.comments?.length ?? 0);
</script>

<a
  href="/boards/{boardId}/cards/{card.id}"
  class="block rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
>
  {#if labelCount > 0}
    <div class="mb-2 flex flex-wrap gap-1">
      {#each card.cardLabels as cl}
        <span
          class="inline-block h-2 w-8 rounded-full"
          style="background-color: {cl.label.color}"
        ></span>
      {/each}
    </div>
  {/if}

  <p class="text-sm font-medium">{card.title}</p>

  {#if hasDescription || commentCount > 0 || card.dueDate}
    <div class="mt-2 flex items-center gap-3 text-xs text-neutral-500">
      {#if card.dueDate}
        <span class="flex items-center gap-1">
          <Calendar class="h-3 w-3" />
          {new Date(card.dueDate).toLocaleDateString()}
        </span>
      {/if}
      {#if commentCount > 0}
        <span class="flex items-center gap-1">
          <MessageSquare class="h-3 w-3" />
          {commentCount}
        </span>
      {/if}
    </div>
  {/if}
</a>
```

### Card Detail

Full card view with editable title, description, and metadata sidebar.

```svelte
<!-- src/lib/components/card/CardDetail.svelte -->
<!-- NOTE: Requires textarea shadcn-svelte component to be installed -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea";
  import XIcon from "@lucide/svelte/icons/x";
  import { superForm } from "sveltekit-superforms";
  import type { SuperValidated } from "sveltekit-superforms";
  import type { UpdateCardSchema } from "$lib/schemas/card";
  import DeleteCardDialog from "$lib/components/card/DeleteCardDialog.svelte";

  let { card, boardId, updateForm }: {
    card: Card;
    boardId: string;
    updateForm: SuperValidated<UpdateCardSchema>;
  } = $props();

  const { form, enhance } = superForm(updateForm);

  let editingTitle = $state(false);
  let showDelete = $state(false);
</script>

<div class="mx-auto max-w-3xl space-y-6 py-8">
  <div class="flex items-start justify-between">
    {#if editingTitle}
      <form method="POST" action="?/update" use:enhance class="flex-1">
        <Input
          name="title"
          bind:value={$form.title}
          class="text-xl font-bold"
          onblur={() => editingTitle = false}
          autofocus
        />
      </form>
    {:else}
      <h1
        class="flex-1 text-xl font-bold"
        role="button"
        tabindex="0"
        ondblclick={() => editingTitle = true}
        onkeydown={(e) => { if (e.key === "Enter") editingTitle = true; }}
      >
        {card.title}
      </h1>
    {/if}

    <a href="/boards/{boardId}">
      <Button variant="ghost" size="icon">
        <X class="h-4 w-4" />
      </Button>
    </a>
  </div>

  <form method="POST" action="?/update" use:enhance class="space-y-4">
    <div>
      <label for="description" class="mb-1 block text-sm font-medium text-neutral-500">
        Description
      </label>
      <Textarea
        id="description"
        name="description"
        bind:value={$form.description}
        placeholder="Add a description..."
        rows={6}
      />
    </div>
    <Button type="submit" size="sm">Save</Button>
  </form>

  <div class="border-t pt-4">
    <Button variant="destructive" size="sm" onclick={() => showDelete = true}>
      Delete Card
    </Button>
  </div>

  <DeleteCardDialog bind:open={showDelete} {card} {boardId} />
</div>
```

### Delete Card Dialog

AlertDialog confirmation for card deletion.

```svelte
<!-- src/lib/components/card/DeleteCardDialog.svelte -->
<script lang="ts">
  import type { Card } from "$lib/types";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";

  let { card, boardId, open = $bindable(false) }: {
    card: Card;
    boardId: string;
    open: boolean;
  } = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete "{card.title}"?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone. The card and all its comments will be permanently removed.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <form method="POST" action="/boards/{boardId}?/deleteCard">
        <input type="hidden" name="cardId" value={card.id} />
        <Button type="submit" variant="destructive">Delete</Button>
      </form>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```

### Add Card (Column Footer)

Inline form that expands in the column footer to create a new card.

```svelte
<!-- src/lib/components/card/AddCard.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { superForm } from "sveltekit-superforms";
  import type { SuperValidated, Infer } from "sveltekit-superforms";
  import type { createCardSchema } from "$lib/schemas/card";

  let { columnId, form: formData }: {
    columnId: string;
    form: SuperValidated<CreateCardSchema>;
  } = $props();

  const { form, enhance } = superForm(formData, {
    resetForm: true,
    onResult: () => { adding = false; },
  });

  let adding = $state(false);
</script>

{#if adding}
  <form method="POST" action="?/createCard" use:enhance class="space-y-2 p-2">
    <input type="hidden" name="columnId" value={columnId} />
    <Input name="title" bind:value={$form.title} placeholder="Card title" autofocus />
    <div class="flex gap-2">
      <Button type="submit" size="sm">Add Card</Button>
      <Button variant="ghost" size="sm" onclick={() => adding = false}>
        <X class="h-4 w-4" />
      </Button>
    </div>
  </form>
{:else}
  <div class="p-2">
    <Button variant="ghost" class="w-full justify-start text-neutral-500" size="sm" onclick={() => adding = true}>
      <Plus class="mr-2 h-4 w-4" />
      Add Card
    </Button>
  </div>
{/if}
```

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
| `src/lib/components/card/DeleteCardDialog.svelte` | Delete confirmation dialog |
| `src/lib/components/card/AddCard.svelte` | Inline form to create a new card |
