# Labels

## Overview

Labels provide a visual categorization system for cards, enabling quick filtering and scanning. Labels are board-scoped — each board has its own set of labels with a name and color. Cards can have multiple labels assigned via a many-to-many join table. Label CRUD uses SvelteKit form actions, label assignment uses a popover multi-select in the card detail view, and board-level filtering uses client-side derived state with OR logic.

## Requirements

### Create Label
- User can create labels at the board level
- Labels have a name and a color
- Color is selected from a predefined palette

### Assign Labels
- User can assign one or more labels to a card
- Labels are displayed as colored tags on the card in the board view
- Labels can be added/removed from the card detail view

### Edit Label
- User can rename a label or change its color
- Changes apply to all cards using that label

### Delete Label
- User can delete a label
- Deleting a label removes it from all cards

### Filter by Label
- User can filter the board view to show only cards with specific labels
- Multiple labels can be selected for filtering (OR logic — show cards matching any selected label)

## Database Schema

### Labels Table

Board-scoped labels in `src/lib/db/schema/labels.ts`:

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { boards } from "./boards";

export const labels = pgTable("labels", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Card–Label Join Table

Many-to-many relationship in `src/lib/db/schema/card-labels.ts`:

```typescript
import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { cards } from "./cards";
import { labels } from "./labels";

export const cardLabels = pgTable(
  "card_labels",
  {
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    labelId: uuid("label_id").notNull().references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
);
```

### Relations

```typescript
import { relations } from "drizzle-orm";
import { labels } from "./labels";
import { boards } from "./boards";
import { cardLabels } from "./card-labels";
import { cards } from "./cards";

export const labelsRelations = relations(labels, ({ one, many }) => ({
  board: one(boards, { fields: [labels.boardId], references: [boards.id] }),
  cardLabels: many(cardLabels),
}));

export const cardLabelsRelations = relations(cardLabels, ({ one }) => ({
  card: one(cards, { fields: [cardLabels.cardId], references: [cards.id] }),
  label: one(labels, { fields: [cardLabels.labelId], references: [labels.id] }),
}));
```

The `cards` table also references `cardLabels` in its relations — see `specs/cards.md` for the `cardsRelations` definition.

## Color Palette

A predefined set of label colors in `src/lib/utils/label-colors.ts`:

```typescript
export const LABEL_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number]["value"];
```

## Validation Schemas

Zod schemas in `src/lib/schemas/label.ts`:

```typescript
import { z } from "zod/v4";

export const createLabelSchema = z.object({
  name: z.string().min(1, "Label name is required").max(50),
  color: z.string().min(1, "Color is required"),
});

export const updateLabelSchema = z.object({
  labelId: z.string().uuid(),
  name: z.string().min(1, "Label name is required").max(50),
  color: z.string().min(1, "Color is required"),
});

export const deleteLabelSchema = z.object({
  labelId: z.string().uuid(),
});

export const toggleCardLabelSchema = z.object({
  cardId: z.string().uuid(),
  labelId: z.string().uuid(),
});
```

## Routes

| Route | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Label CRUD form actions (createLabel, updateLabel, deleteLabel) |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | `toggleLabel` action to assign/remove a label from a card |

## Server Load Functions

### Board Page (Labels Included)

The board page load function includes all board labels so they're available for filtering and display:

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts (load)
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
            },
          },
        },
      },
      labels: true, // All labels for the board (used in filter UI and label management)
    },
  });

  if (!board) throw error(404, "Board not found");

  // ... form initialization, return board data
};
```

### Card Detail Page (Labels Included)

The card detail load includes the card's assigned labels and the full board label list for the assignment popover:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (load)
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

  // Load all board labels for the assignment popover
  const boardLabels = await db.query.labels.findMany({
    where: (labels, { eq }) => eq(labels.boardId, params.boardId),
  });

  // ... form initialization
  return { card, boardId: params.boardId, boardLabels, updateForm };
};
```

## Form Actions

### Label CRUD (Board Page)

Create, update, and delete labels at the board level:

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts (actions — label-related)
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { createLabelSchema, updateLabelSchema, deleteLabelSchema } from "$lib/schemas/label";
import { labels } from "$lib/db/schema/labels";
import { eq } from "drizzle-orm";

export const actions: Actions = {
  // ... existing card actions

  createLabel: async ({ request, params }) => {
    const form = await superValidate(request, zod4(createLabelSchema));
    if (!form.valid) return fail(400, { form });

    await db.insert(labels).values({
      boardId: params.boardId,
      name: form.data.name,
      color: form.data.color,
    });

    return { form };
  },

  updateLabel: async ({ request }) => {
    const form = await superValidate(request, zod4(updateLabelSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(labels)
      .set({ name: form.data.name, color: form.data.color })
      .where(eq(labels.id, form.data.labelId));

    return { form };
  },

  deleteLabel: async ({ request }) => {
    const form = await superValidate(request, zod4(deleteLabelSchema));
    if (!form.valid) return fail(400, { form });

    await db.delete(labels).where(eq(labels.id, form.data.labelId));

    return { form };
  },
};
```

### Toggle Label Assignment (Card Detail Page)

Assign or remove a label from a card. If the card–label pair exists, remove it; otherwise, insert it:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (actions)
import { toggleCardLabelSchema } from "$lib/schemas/label";
import { cardLabels } from "$lib/db/schema/card-labels";
import { and, eq } from "drizzle-orm";

export const actions: Actions = {
  // ... existing update action

  toggleLabel: async ({ request }) => {
    const form = await superValidate(request, zod4(toggleCardLabelSchema));
    if (!form.valid) return fail(400, { form });

    const existing = await db.query.cardLabels.findFirst({
      where: (cl, { and, eq }) =>
        and(eq(cl.cardId, form.data.cardId), eq(cl.labelId, form.data.labelId)),
    });

    if (existing) {
      await db.delete(cardLabels).where(
        and(
          eq(cardLabels.cardId, form.data.cardId),
          eq(cardLabels.labelId, form.data.labelId),
        ),
      );
    } else {
      await db.insert(cardLabels).values({
        cardId: form.data.cardId,
        labelId: form.data.labelId,
      });
    }

    return { form };
  },
};
```

## Component Patterns

### Label Badge

A small colored badge used to display a label on cards and in the label manager:

```svelte
<!-- src/lib/components/label/LabelBadge.svelte -->
<script lang="ts">
  let { name, color, size = "sm" }: {
    name: string;
    color: string;
    size?: "sm" | "md";
  } = $props();

  let sizeClasses = $derived(
    size === "sm" ? "h-2 w-8 rounded-full" : "px-2 py-0.5 rounded text-xs font-medium",
  );
</script>

{#if size === "sm"}
  <span
    class={sizeClasses}
    style="background-color: {color}"
    title={name}
  ></span>
{:else}
  <span
    class={sizeClasses}
    style="background-color: {color}; color: white"
  >
    {name}
  </span>
{/if}
```

### Label Picker (Card Detail View)

A popover with checkboxes to assign/remove labels from a card. Each toggle submits a form action:

```svelte
<!-- src/lib/components/label/LabelPicker.svelte -->
<script lang="ts">
  import { Tag } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Popover from "$lib/components/ui/popover";
  import LabelBadge from "$lib/components/label/LabelBadge.svelte";
  import { enhance } from "$app/forms";

  let { cardId, boardLabels, assignedLabelIds }: {
    cardId: string;
    boardLabels: Array<{ id: string; name: string; color: string }>;
    assignedLabelIds: string[];
  } = $props();

  let open = $state(false);

  function isAssigned(labelId: string) {
    return assignedLabelIds.includes(labelId);
  }
</script>

<div class="space-y-1">
  <label class="text-sm font-medium text-neutral-500">Labels</label>
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
      <Button variant="outline" size="sm" {...props} class="w-full justify-start">
        <Tag class="mr-2 h-4 w-4" />
        {#if assignedLabelIds.length > 0}
          {assignedLabelIds.length} label{assignedLabelIds.length === 1 ? "" : "s"}
        {:else}
          Add labels
        {/if}
      </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-60 p-2" align="start">
      <div class="space-y-1">
        {#each boardLabels as label}
          <form method="POST" action="?/toggleLabel" use:enhance>
            <input type="hidden" name="cardId" value={cardId} />
            <input type="hidden" name="labelId" value={label.id} />
            <button
              type="submit"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span
                class="h-4 w-4 rounded"
                style="background-color: {label.color}"
              ></span>
              <span class="flex-1 text-left">{label.name}</span>
              {#if isAssigned(label.id)}
                <span class="text-xs text-green-600">&#10003;</span>
              {/if}
            </button>
          </form>
        {/each}
      </div>
    </Popover.Content>
  </Popover.Root>
</div>
```

### Label Manager (Board Settings)

A panel or dialog for creating, editing, and deleting labels at the board level:

```svelte
<!-- src/lib/components/label/LabelManager.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Plus, Pencil, Trash2 } from "@lucide/svelte";
  import { LABEL_COLORS } from "$lib/utils/label-colors";
  import { enhance } from "$app/forms";

  let { labels: boardLabels }: {
    labels: Array<{ id: string; name: string; color: string }>;
  } = $props();

  let newName = $state("");
  let newColor = $state(LABEL_COLORS[0].value);
  let editingId = $state<string | null>(null);
  let editName = $state("");
  let editColor = $state("");

  function startEdit(label: { id: string; name: string; color: string }) {
    editingId = label.id;
    editName = label.name;
    editColor = label.color;
  }

  function cancelEdit() {
    editingId = null;
  }
</script>

<div class="space-y-4">
  <h3 class="text-sm font-medium">Labels</h3>

  <!-- Existing labels -->
  <div class="space-y-2">
    {#each boardLabels as label}
      {#if editingId === label.id}
        <form method="POST" action="?/updateLabel" use:enhance class="flex items-center gap-2">
          <input type="hidden" name="labelId" value={label.id} />
          <div class="flex gap-1">
            {#each LABEL_COLORS as c}
              <button
                type="button"
                class="h-6 w-6 rounded-full border-2"
                style="background-color: {c.value}; border-color: {editColor === c.value ? 'white' : 'transparent'}"
                onclick={() => editColor = c.value}
              ></button>
            {/each}
          </div>
          <input type="hidden" name="color" value={editColor} />
          <Input name="name" bind:value={editName} class="h-8 flex-1" />
          <Button type="submit" size="sm">Save</Button>
          <Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
        </form>
      {:else}
        <div class="flex items-center gap-2">
          <span class="h-4 w-4 rounded" style="background-color: {label.color}"></span>
          <span class="flex-1 text-sm">{label.name}</span>
          <Button variant="ghost" size="icon" class="h-7 w-7" onclick={() => startEdit(label)}>
            <Pencil class="h-3 w-3" />
          </Button>
          <form method="POST" action="?/deleteLabel" use:enhance>
            <input type="hidden" name="labelId" value={label.id} />
            <Button type="submit" variant="ghost" size="icon" class="h-7 w-7 text-red-500">
              <Trash2 class="h-3 w-3" />
            </Button>
          </form>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Create new label -->
  <form method="POST" action="?/createLabel" use:enhance class="space-y-2 border-t pt-3">
    <div class="flex gap-1">
      {#each LABEL_COLORS as c}
        <button
          type="button"
          class="h-6 w-6 rounded-full border-2"
          style="background-color: {c.value}; border-color: {newColor === c.value ? 'white' : 'transparent'}"
          onclick={() => newColor = c.value}
        ></button>
      {/each}
    </div>
    <input type="hidden" name="color" value={newColor} />
    <div class="flex gap-2">
      <Input name="name" bind:value={newName} placeholder="Label name" class="h-8 flex-1" />
      <Button type="submit" size="sm">
        <Plus class="mr-1 h-3 w-3" />
        Add
      </Button>
    </div>
  </form>
</div>
```

### CardItem Integration

The existing `CardItem.svelte` (see `specs/cards.md`) already displays label color swatches via the `cardLabels` relation:

```svelte
<!-- In src/lib/components/card/CardItem.svelte -->
{#if labelCount > 0}
  <div class="mb-2 flex flex-wrap gap-1">
    {#each card.cardLabels as cl}
      <LabelBadge name={cl.label.name} color={cl.label.color} size="sm" />
    {/each}
  </div>
{/if}
```

### Card Detail Integration

Add `LabelPicker` to the card detail sidebar:

```svelte
<!-- In src/lib/components/card/CardDetail.svelte -->
<script lang="ts">
  import LabelPicker from "$lib/components/label/LabelPicker.svelte";
  // ... existing imports

  let { card, boardId, boardLabels, updateForm }: {
    card: Card;
    boardId: string;
    boardLabels: Array<{ id: string; name: string; color: string }>;
    updateForm: SuperValidated<UpdateCardSchema>;
  } = $props();

  let assignedLabelIds = $derived(card.cardLabels.map((cl) => cl.labelId));
</script>

<!-- In the sidebar area -->
<LabelPicker cardId={card.id} {boardLabels} {assignedLabelIds} />
```

## Board-Level Filtering

Label filtering is client-side derived state. The board page maintains a set of selected label IDs and filters the card lists:

```svelte
<!-- In the board page or a FilterBar component -->
<script lang="ts">
  let selectedLabelIds = $state<Set<string>>(new Set());

  function toggleLabelFilter(labelId: string) {
    if (selectedLabelIds.has(labelId)) {
      selectedLabelIds.delete(labelId);
    } else {
      selectedLabelIds.add(labelId);
    }
    selectedLabelIds = new Set(selectedLabelIds); // trigger reactivity
  }

  // OR logic: show cards matching any selected label
  function filterCards(cards: Card[]) {
    if (selectedLabelIds.size === 0) return cards;
    return cards.filter((card) =>
      card.cardLabels.some((cl) => selectedLabelIds.has(cl.labelId)),
    );
  }
</script>
```

### Filter Bar Component

A row of label toggles displayed above the board columns:

```svelte
<!-- src/lib/components/label/LabelFilterBar.svelte -->
<script lang="ts">
  import { cn } from "$lib/utils";

  let { labels, selectedIds, onToggle }: {
    labels: Array<{ id: string; name: string; color: string }>;
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
  } = $props();
</script>

{#if labels.length > 0}
  <div class="flex flex-wrap items-center gap-2 px-4 py-2">
    <span class="text-xs font-medium text-neutral-500">Filter:</span>
    {#each labels as label}
      <button
        class={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
          selectedIds.has(label.id)
            ? "ring-2 ring-offset-1 ring-neutral-400 dark:ring-neutral-500"
            : "opacity-60 hover:opacity-100",
        )}
        style="background-color: {label.color}; color: white"
        onclick={() => onToggle(label.id)}
      >
        {label.name}
      </button>
    {/each}
    {#if selectedIds.size > 0}
      <button
        class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        onclick={() => { selectedIds.clear(); selectedIds = new Set(); }}
      >
        Clear
      </button>
    {/if}
  </div>
{/if}
```

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/labels.ts` | Labels table schema and relations |
| `src/lib/db/schema/card-labels.ts` | Card–label join table schema and relations |
| `src/lib/schemas/label.ts` | Zod validation schemas for label forms |
| `src/lib/utils/label-colors.ts` | Predefined color palette constant |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Label CRUD form actions; board load includes labels |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | `toggleLabel` action; loads board labels for picker |
| `src/lib/components/label/LabelBadge.svelte` | Colored badge for displaying a label |
| `src/lib/components/label/LabelPicker.svelte` | Popover multi-select to assign labels to a card |
| `src/lib/components/label/LabelManager.svelte` | Board-level label CRUD panel |
| `src/lib/components/label/LabelFilterBar.svelte` | Board-level filter bar with label toggles |
| `src/lib/components/card/CardItem.svelte` | Displays label badges on board cards |
| `src/lib/components/card/CardDetail.svelte` | Includes LabelPicker in sidebar |
