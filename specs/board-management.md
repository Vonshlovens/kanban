# Board Management

## Overview

Users can create, configure, and manage kanban boards as top-level containers for organizing work. Board operations use SvelteKit form actions for mutations, server load functions for data fetching, and Drizzle ORM for database access.

## Requirements

### Create Board
- User can create a new board with a name and optional description
- Board names must be non-empty and unique per user/workspace
- New boards start with default columns: "To Do", "In Progress", "Done"

### Edit Board
- User can rename a board
- User can update the board description
- Changes are reflected immediately for all viewers

### Delete Board
- User can delete a board they own
- Deletion requires confirmation via alert dialog
- Deleting a board cascades to all its columns, cards, and related data
- Deleted boards cannot be recovered

### Board Listing
- User can view all boards they have access to
- Boards display their name, description, and card count summary
- User can set a default/favorite board

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
| `src/routes/(app)/boards/new/+page.server.ts` | Create board form action |
| `src/routes/(app)/boards/[boardId]/settings/+page.server.ts` | Rename, update description, delete actions |

## Server Load Functions

### Board Listing

```typescript
// src/routes/+page.server.ts
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/db";

export const load: PageServerLoad = async () => {
  const boards = await db.query.boards.findMany({
    orderBy: (boards, { desc }) => [desc(boards.updatedAt)],
  });

  if (boards.length === 1) {
    throw redirect(303, `/boards/${boards[0].id}`);
  }

  return { boards };
};
```

### Board Settings

```typescript
// src/routes/(app)/boards/[boardId]/settings/+page.server.ts
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { renameBoardSchema, updateBoardDescriptionSchema } from "$lib/schemas/board";
import { db } from "$lib/db";

export const load: PageServerLoad = async ({ params }) => {
  const board = await db.query.boards.findFirst({
    where: (boards, { eq }) => eq(boards.id, params.boardId),
  });

  if (!board) throw error(404, "Board not found");

  const renameForm = await superValidate(board, zod(renameBoardSchema));
  const descriptionForm = await superValidate(board, zod(updateBoardDescriptionSchema));

  return { board, renameForm, descriptionForm };
};
```

## Form Actions

### Create Board

Creates a board with default columns in a single transaction:

```typescript
// src/routes/(app)/boards/new/+page.server.ts
import type { Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { createBoardSchema } from "$lib/schemas/board";
import { db } from "$lib/db";
import { boards } from "$lib/db/schema/boards";
import { columns } from "$lib/db/schema/columns";

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(createBoardSchema));
    if (!form.valid) return fail(400, { form });

    const [board] = await db.transaction(async (tx) => {
      const [board] = await tx.insert(boards)
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

### Rename Board

```typescript
// src/routes/(app)/boards/[boardId]/settings/+page.server.ts (actions)
import type { Actions } from "./$types";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { renameBoardSchema, updateBoardDescriptionSchema } from "$lib/schemas/board";
import { db } from "$lib/db";
import { boards } from "$lib/db/schema/boards";
import { eq } from "drizzle-orm";

export const actions: Actions = {
  rename: async ({ request, params }) => {
    const form = await superValidate(request, zod(renameBoardSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(boards)
      .set({ name: form.data.name, updatedAt: new Date() })
      .where(eq(boards.id, params.boardId));

    return { form };
  },

  updateDescription: async ({ request, params }) => {
    const form = await superValidate(request, zod(updateBoardDescriptionSchema));
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

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/boards.ts` | Board database schema |
| `src/lib/schemas/board.ts` | Zod validation schemas for board forms |
| `src/routes/+page.server.ts` | Board listing load, single-board redirect |
| `src/routes/+page.svelte` | Board listing page |
| `src/routes/(app)/boards/new/+page.svelte` | Create board form |
| `src/routes/(app)/boards/new/+page.server.ts` | Create board action with default columns |
| `src/routes/(app)/boards/[boardId]/settings/+page.svelte` | Board settings UI |
| `src/routes/(app)/boards/[boardId]/settings/+page.server.ts` | Rename, update description, delete, favorite actions |
| `src/lib/components/board/BoardCard.svelte` | Board card for listing view |
