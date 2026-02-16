# Board Management

> **Status:** Implemented. All board CRUD operations, listing, and settings pages are functional.

## Overview

Users can create, configure, and manage kanban boards as top-level containers for organizing work. Board operations use SvelteKit form actions for mutations, server load functions for data fetching, and Drizzle ORM for database access.

## Requirements

### Create Board
- User can create a new board with a name and optional description
- Board names must be non-empty (max 100 chars)
- New boards start with default columns: "To Do", "In Progress", "Done"
- After creation, user is redirected to the new board

### Edit Board
- User can rename a board from the settings page
- User can update the board description
- User can toggle favorite status (pins board to sidebar)

### Delete Board
- User can delete a board from the settings page
- Deletion requires confirmation via AlertDialog
- Deleting a board cascades to all its columns, cards, and related data (via DB foreign keys)
- After deletion, user is redirected to the root landing page

### Board Listing
- Root page (`/`) loads all boards sorted by most recently updated
- If exactly one board exists, auto-redirects to that board
- Boards display name, description, favorite status, and relative update time
- Empty state provides CTA to create first board
- Board cards in the listing are rendered inline (no separate BoardCard component)

## Database Schema

The `boards` table in `src/lib/db/schema/boards.ts`:

```typescript
import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

## Validation Schemas

Zod schemas in `src/lib/schemas/board.ts`:

```typescript
import { z } from "zod/v4";

export const createBoardSchema = z.object({
  name: z.string().min(1, "Board name is required").max(100),
  description: z.string().max(500).optional(),
});

export const renameBoardSchema = z.object({
  name: z.string().min(1, "Board name is required").max(100),
});

export const updateBoardDescriptionSchema = z.object({
  description: z.string().max(500),
});
```

## Routes

| Route | Purpose |
| --- | --- |
| `src/routes/+page.server.ts` | Board listing load, single-board redirect |
| `src/routes/+page.svelte` | Board listing UI with grid of cards |
| `src/routes/(app)/boards/new/+page.server.ts` | Create board load + default form action |
| `src/routes/(app)/boards/new/+page.svelte` | Create board form UI |
| `src/routes/(app)/boards/[boardId]/settings/+page.server.ts` | Settings load + rename, updateDescription, delete, toggleFavorite actions |
| `src/routes/(app)/boards/[boardId]/settings/+page.svelte` | Board settings UI |

## Server Load Functions

### Board Listing

```typescript
// src/routes/+page.server.ts
export const load: PageServerLoad = async () => {
  const allBoards = await db
    .select()
    .from(boards)
    .orderBy(desc(boards.updatedAt));

  if (allBoards.length === 1) {
    throw redirect(303, `/boards/${allBoards[0].id}`);
  }

  return { boards: allBoards };
};
```

### Board Settings

```typescript
// src/routes/(app)/boards/[boardId]/settings/+page.server.ts
export const load: PageServerLoad = async ({ params }) => {
  const board = await db.query.boards.findFirst({
    where: (boards, { eq }) => eq(boards.id, params.boardId),
  });

  if (!board) throw error(404, "Board not found");

  const renameForm = await superValidate(
    { name: board.name },
    zod4(renameBoardSchema),
  );
  const descriptionForm = await superValidate(
    { description: board.description ?? "" },
    zod4(updateBoardDescriptionSchema),
  );

  return { board, renameForm, descriptionForm };
};
```

## Form Actions

### Create Board

Creates a board with default columns in a single transaction:

```typescript
// src/routes/(app)/boards/new/+page.server.ts
export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod4(createBoardSchema));
    if (!form.valid) return fail(400, { form });

    const [board] = await db.transaction(async (tx) => {
      const [board] = await tx
        .insert(boards)
        .values({ name: form.data.name, description: form.data.description })
        .returning();

      await tx.insert(columns).values([
        { boardId: board.id, name: "To Do", position: 0 },
        { boardId: board.id, name: "In Progress", position: 1 },
        { boardId: board.id, name: "Done", position: 2 },
      ]);

      return [board];
    });

    throw redirect(303, `/boards/${board.id}`);
  },
};
```

### Settings Actions

```typescript
// src/routes/(app)/boards/[boardId]/settings/+page.server.ts
export const actions: Actions = {
  rename: async ({ request, params }) => { /* validates & updates name */ },
  updateDescription: async ({ request, params }) => { /* validates & updates description */ },
  delete: async ({ params }) => { /* deletes board, redirects to / */ },
  toggleFavorite: async ({ params }) => { /* toggles isFavorite flag */ },
};
```

## UI Patterns

### Form Pattern

All forms use sveltekit-superforms with plain HTML form elements (no formsnap `Form.Field`). Forms include `onResult` callbacks for toast notifications:

```svelte
<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  const { form, enhance, errors } = superForm(data.form, {
    onResult: ({ result }) => {
      if (result.type === "success") toast.success("Changes saved");
      else if (result.type === "error") toast.error("Failed to save changes");
    },
  });
</script>

<form method="POST" action="?/actionName" use:enhance>
  <Input name="fieldName" bind:value={$form.fieldName} />
  {#if $errors.fieldName}
    <p class="text-destructive">{$errors.fieldName[0]}</p>
  {/if}
  <Button type="submit">Save</Button>
</form>
```

### Delete Confirmation Pattern

Uses AlertDialog with a hidden form + `requestSubmit()`. The form uses SvelteKit's `enhance` for toast notifications:

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  let deleteFormEl: HTMLFormElement | undefined = $state();
</script>

<AlertDialog.Root>
  <AlertDialog.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="destructive">Delete</Button>
    {/snippet}
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <!-- header/description -->
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={() => deleteFormEl?.requestSubmit()}>
        Delete board
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<form
  bind:this={deleteFormEl}
  method="POST"
  action="?/delete"
  class="hidden"
  use:enhance={() => {
    return async ({ result }) => {
      if (result.type === "redirect") {
        toast.success("Board deleted");
        const { goto } = await import("$app/navigation");
        goto(result.location);
      } else if (result.type === "error") {
        toast.error("Failed to delete board");
      }
    };
  }}
/>
```

### Toast Notifications

All board CRUD actions show toast notifications for user feedback:

| Action | Success Message | Error Message |
| --- | --- | --- |
| Create board | "Board created" | "Failed to create board" |
| Rename board | "Board renamed" | "Failed to rename board" |
| Update description | "Description updated" | "Failed to update description" |
| Toggle favorite | "Added to favorites" / "Removed from favorites" | "Failed to update favorite status" |
| Delete board | "Board deleted" | "Failed to delete board" |

**Implementation patterns:**
- `superForm` actions use `onResult` callback for toasts
- Plain forms (favorite toggle, delete) use SvelteKit's `enhance` from `$app/forms`
- Delete actions that redirect use `goto()` from `$app/navigation` after showing the toast

### Navbar Settings Link

The Navbar shows a settings gear icon when viewing a board, linking to `/boards/{boardId}/settings`.

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/boards.ts` | Board database schema |
| `src/lib/schemas/board.ts` | Zod validation schemas for board forms |
| `src/routes/+page.server.ts` | Board listing load, single-board redirect |
| `src/routes/+page.svelte` | Board listing page (inline board cards) |
| `src/routes/(app)/boards/new/+page.svelte` | Create board form |
| `src/routes/(app)/boards/new/+page.server.ts` | Create board action with default columns |
| `src/routes/(app)/boards/[boardId]/settings/+page.svelte` | Board settings UI |
| `src/routes/(app)/boards/[boardId]/settings/+page.server.ts` | Settings actions (rename, description, delete, favorite) |
| `src/lib/components/layout/Navbar.svelte` | Navbar with settings link |
