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
import type { BoardSummary } from "$lib/types";

export const load: PageServerLoad = async () => {
  const allBoards: BoardSummary[] = await db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      isFavorite: boards.isFavorite,
      updatedAt: boards.updatedAt,
    })
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
// src/routes/(app)/boards/[boardId]/settings/+page.server.ts (actions)
import type { Actions } from "./$types";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { renameBoardSchema, updateBoardDescriptionSchema } from "$lib/schemas/board";
import { db } from "$lib/db";
import { boards } from "$lib/db/schema/boards";
import { eq } from "drizzle-orm";

export const actions: Actions = {
  rename: async ({ request, params }) => {
    const form = await superValidate(request, zod4(renameBoardSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(boards)
      .set({ name: form.data.name, updatedAt: new Date() })
      .where(eq(boards.id, params.boardId));

    return { form };
  },

  updateDescription: async ({ request, params }) => {
    const form = await superValidate(request, zod4(updateBoardDescriptionSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(boards)
      .set({ description: form.data.description, updatedAt: new Date() })
      .where(eq(boards.id, params.boardId));

    return { form };
  },

  delete: async ({ params }) => {
    await db.delete(boards).where(eq(boards.id, params.boardId));
    throw redirect(303, "/");
  },

  toggleFavorite: async ({ params }) => {
    const board = await db.query.boards.findFirst({
      where: (boards, { eq }) => eq(boards.id, params.boardId),
      columns: { isFavorite: true },
    });

    if (!board) throw error(404, "Board not found");

    await db.update(boards)
      .set({ isFavorite: !board.isFavorite, updatedAt: new Date() })
      .where(eq(boards.id, params.boardId));
  },
};
```

## Component Patterns

### Board Listing Page

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

> **Implementation note:** Board cards in the listing are rendered inline (no separate BoardCard component). Empty state provides CTA to create first board.

### Board Settings Page

```svelte
<!-- src/routes/(app)/boards/[boardId]/settings/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import * as Card from "$lib/components/ui/card";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { superForm } from "sveltekit-superforms";

  let { data }: { data: PageData } = $props();

  const { form: renameForm, enhance: renameEnhance } = superForm(data.renameForm);
  let deleteConfirmOpen = $state(false);
</script>

<div class="container mx-auto max-w-2xl py-10 space-y-8">
  <h1 class="text-2xl font-bold">Board Settings</h1>

  <Card.Root>
    <Card.Header>
      <Card.Title>General</Card.Title>
    </Card.Header>
    <Card.Content>
      <form method="POST" action="?/rename" use:renameEnhance class="flex gap-3">
        <Input name="name" bind:value={$renameForm.name} class="flex-1" />
        <Button type="submit">Save</Button>
      </form>
    </Card.Content>
  </Card.Root>

  <Card.Root class="border-destructive">
    <Card.Header>
      <Card.Title class="text-destructive">Danger Zone</Card.Title>
    </Card.Header>
    <Card.Content>
      <AlertDialog.Root bind:open={deleteConfirmOpen}>
        <AlertDialog.Trigger asChild let:builder>
          <Button variant="destructive" builders={[builder]}>Delete Board</Button>
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete "{data.board.name}"?</AlertDialog.Title>
            <AlertDialog.Description>
              This will permanently delete the board and all its columns, cards, and data. This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <form method="POST" action="?/delete">
              <AlertDialog.Action type="submit" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialog.Action>
            </form>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card.Content>
  </Card.Root>
</div>
```

### Create Board Page

```svelte
<!-- src/routes/(app)/boards/new/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import * as Form from "$lib/components/ui/form";
  import { superForm } from "sveltekit-superforms";

  let { data }: { data: PageData } = $props();
  const { form, enhance } = superForm(data.form);
</script>

<div class="container mx-auto flex max-w-md items-center justify-center py-20">
  <Card.Root class="w-full">
    <Card.Header>
      <Card.Title>Create Board</Card.Title>
      <Card.Description>Give your board a name to get started.</Card.Description>
    </Card.Header>
    <Card.Content>
      <form method="POST" use:enhance class="space-y-4">
        <Form.Field {form} name="name">
          <Form.Control let:attrs>
            <Input {...attrs} bind:value={$form.name} placeholder="Board name" />
          </Form.Control>
          <Form.FieldErrors />
        </Form.Field>
        <Button type="submit" class="w-full">Create</Button>
      </form>
    </Card.Content>
  </Card.Root>
</div>
```

## UI Patterns

### Form Pattern

All forms use sveltekit-superforms with plain HTML form elements (no formsnap `Form.Field`). Forms include `onResult` callbacks for toast notifications and destructure `submitting` for loading states:

```svelte
<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  const { form, enhance, errors, submitting } = superForm(data.form, {
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
  <Button type="submit" disabled={$submitting}>
    {#if $submitting}
      <LoaderCircleIcon class="size-3.5 animate-spin" />
    {/if}
    Save
  </Button>
</form>
```

### Delete Confirmation Pattern

Uses AlertDialog with a hidden form + `requestSubmit()`. The form uses SvelteKit's `enhance` for toast notifications. A manual `$state` boolean tracks submission for loading UI:

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  let deleteFormEl: HTMLFormElement | undefined = $state();
  let deleting = $state(false);
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
      <AlertDialog.Action
        onclick={() => { deleting = true; deleteFormEl?.requestSubmit(); }}
        disabled={deleting}
      >
        {#if deleting}
          <LoaderCircleIcon class="size-3.5 animate-spin" />
        {/if}
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
        deleting = false;
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
