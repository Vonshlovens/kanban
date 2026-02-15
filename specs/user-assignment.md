# User Assignment

## Overview

Cards can be assigned to a single user to indicate ownership and responsibility for a work item. Assignment uses a nullable `assigneeId` foreign key on the `cards` table pointing to the `users` table. The user picker is a popover in the card detail view, and cards show an avatar/initials indicator on the board. A self-assignment shortcut lets the current user claim a card with one click.

## Requirements

### Assign User
- User can assign a member to a card
- Each card supports a single assignee
- Assignee is selectable from a list of board members
- Assignment can be done from the card detail view or inline on the board

### Unassign User
- User can remove the assignee from a card
- Unassigned cards have no owner indicator

### Assignee Display
- Assigned cards show the user's avatar or initials on the card in the board view
- Hovering over the avatar shows the assignee's name

### Self-Assignment
- User can quickly assign themselves to a card via a shortcut action

## Database Schema

### Users Table

The `users` table in `src/lib/db/schema/users.ts`:

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Cards Table (Extended)

The `cards` table gains a nullable `assigneeId` column referencing `users`. When a user is deleted, assigned cards are set to `null` (unassigned) rather than cascading:

```typescript
// Addition to src/lib/db/schema/cards.ts
import { users } from "./users";

export const cards = pgTable("cards", {
  // ... existing columns (id, columnId, title, description, position, createdAt, updatedAt)
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
});
```

### Relations

```typescript
// src/lib/db/schema/users.ts (relations)
import { relations } from "drizzle-orm";
import { users } from "./users";
import { cards } from "./cards";

export const usersRelations = relations(users, ({ many }) => ({
  assignedCards: many(cards),
}));
```

The `cardsRelations` in `src/lib/db/schema/cards.ts` should include the assignee relation:

```typescript
import { users } from "./users";

export const cardsRelations = relations(cards, ({ one, many }) => ({
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  assignee: one(users, { fields: [cards.assigneeId], references: [users.id] }),
  cardLabels: many(cardLabels),
  comments: many(comments),
}));
```

## Validation Schemas

Zod schemas in `src/lib/schemas/assignment.ts`:

```typescript
import { z } from "zod/v4";

export const assignCardSchema = z.object({
  cardId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const unassignCardSchema = z.object({
  cardId: z.string().uuid(),
});
```

## Routes

| Route | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | `assign` and `unassign` form actions |

## Server Load Functions

### Board Page (Users Included)

The board page load function includes the assignee on each card and a list of all users for the assignment picker:

```typescript
// src/routes/(app)/boards/[boardId]/+page.server.ts (load)
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
              assignee: true, // User data for avatar display
              cardLabels: { with: { label: true } },
            },
          },
        },
      },
      labels: true,
    },
  });

  if (!board) throw error(404, "Board not found");

  // All users available for assignment
  const users = await db.query.users.findMany({
    orderBy: (users, { asc }) => [asc(users.name)],
  });

  // ... form initialization
  return { board, users };
};
```

### Card Detail Page (Assignee Included)

The card detail load includes the current assignee and the full user list for the assignment picker:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (load)
export const load: PageServerLoad = async ({ params }) => {
  const card = await db.query.cards.findFirst({
    where: (cards, { eq }) => eq(cards.id, params.cardId),
    with: {
      assignee: true,
      cardLabels: { with: { label: true } },
      comments: {
        orderBy: (comments, { desc }) => [desc(comments.createdAt)],
      },
    },
  });

  if (!card) throw error(404, "Card not found");

  const boardLabels = await db.query.labels.findMany({
    where: (labels, { eq }) => eq(labels.boardId, params.boardId),
  });

  // All users available for assignment
  const users = await db.query.users.findMany({
    orderBy: (users, { asc }) => [asc(users.name)],
  });

  // ... form initialization
  return { card, boardId: params.boardId, boardLabels, users, updateForm };
};
```

## Form Actions

### Assign User (Card Detail Page)

Sets the `assigneeId` on a card:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (actions)
import { assignCardSchema, unassignCardSchema } from "$lib/schemas/assignment";
import { cards } from "$lib/db/schema/cards";
import { eq } from "drizzle-orm";

export const actions: Actions = {
  // ... existing actions (update, toggleLabel)

  assign: async ({ request }) => {
    const form = await superValidate(request, zod(assignCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(cards)
      .set({ assigneeId: form.data.userId, updatedAt: new Date() })
      .where(eq(cards.id, form.data.cardId));

    return { form };
  },

  unassign: async ({ request }) => {
    const form = await superValidate(request, zod(unassignCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.update(cards)
      .set({ assigneeId: null, updatedAt: new Date() })
      .where(eq(cards.id, form.data.cardId));

    return { form };
  },
};
```

## Component Patterns

### User Avatar

A reusable avatar component that shows the user's image or fallback initials:

```svelte
<!-- src/lib/components/user/UserAvatar.svelte -->
<script lang="ts">
  import { cn } from "$lib/utils";

  let { name, avatarUrl, size = "sm" }: {
    name: string;
    avatarUrl?: string | null;
    size?: "sm" | "md";
  } = $props();

  let initials = $derived(
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  );

  let sizeClasses = $derived(
    size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
  );
</script>

{#if avatarUrl}
  <img
    src={avatarUrl}
    alt={name}
    title={name}
    class={cn("rounded-full object-cover", sizeClasses)}
  />
{:else}
  <span
    class={cn(
      "inline-flex items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
      sizeClasses,
    )}
    title={name}
  >
    {initials}
  </span>
{/if}
```

### User Picker (Card Detail View)

A popover to assign or change the user on a card. Selecting a user submits the `assign` action; a clear button submits the `unassign` action:

```svelte
<!-- src/lib/components/user/UserPicker.svelte -->
<script lang="ts">
  import { UserCircle } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Popover from "$lib/components/ui/popover";
  import UserAvatar from "$lib/components/user/UserAvatar.svelte";
  import { enhance } from "$app/forms";

  let { cardId, users, currentAssignee }: {
    cardId: string;
    users: Array<{ id: string; name: string; avatarUrl?: string | null }>;
    currentAssignee?: { id: string; name: string; avatarUrl?: string | null } | null;
  } = $props();

  let open = $state(false);
</script>

<div class="space-y-1">
  <label class="text-sm font-medium text-neutral-500">Assignee</label>
  <Popover.Root bind:open>
    <Popover.Trigger asChild let:builder>
      <Button variant="outline" size="sm" builders={[builder]} class="w-full justify-start">
        {#if currentAssignee}
          <UserAvatar name={currentAssignee.name} avatarUrl={currentAssignee.avatarUrl} size="sm" />
          <span class="ml-2">{currentAssignee.name}</span>
        {:else}
          <UserCircle class="mr-2 h-4 w-4" />
          Assign
        {/if}
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-60 p-2" align="start">
      <div class="space-y-1">
        {#each users as user}
          <form method="POST" action="?/assign" use:enhance={() => { return async ({ update }) => { await update(); open = false; }; }}>
            <input type="hidden" name="cardId" value={cardId} />
            <input type="hidden" name="userId" value={user.id} />
            <button
              type="submit"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
              <span class="flex-1 text-left">{user.name}</span>
              {#if currentAssignee?.id === user.id}
                <span class="text-xs text-green-600">&#10003;</span>
              {/if}
            </button>
          </form>
        {/each}

        {#if currentAssignee}
          <form method="POST" action="?/unassign" use:enhance={() => { return async ({ update }) => { await update(); open = false; }; }}>
            <input type="hidden" name="cardId" value={cardId} />
            <button
              type="submit"
              class="flex w-full items-center gap-2 rounded border-t px-2 py-1.5 text-sm text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Remove assignee
            </button>
          </form>
        {/if}
      </div>
    </Popover.Content>
  </Popover.Root>
</div>
```

### CardItem Integration

The existing `CardItem.svelte` (see `specs/cards.md`) displays the assignee avatar in the card footer:

```svelte
<!-- In src/lib/components/card/CardItem.svelte -->
<script lang="ts">
  import UserAvatar from "$lib/components/user/UserAvatar.svelte";
  // ... existing imports
</script>

<!-- In the card footer area -->
<div class="flex items-center justify-between">
  <div class="flex items-center gap-1">
    <!-- ... existing label badges, due date, etc. -->
  </div>
  {#if card.assignee}
    <UserAvatar name={card.assignee.name} avatarUrl={card.assignee.avatarUrl} size="sm" />
  {/if}
</div>
```

### Card Detail Integration

Add `UserPicker` to the card detail sidebar alongside `LabelPicker`:

```svelte
<!-- In src/lib/components/card/CardDetail.svelte -->
<script lang="ts">
  import UserPicker from "$lib/components/user/UserPicker.svelte";
  // ... existing imports
</script>

<!-- In the sidebar area -->
<UserPicker cardId={card.id} users={users} currentAssignee={card.assignee} />
```

### Self-Assignment

Self-assignment is a convenience shortcut. The card detail view can show a "Assign to me" button when the current user is not the assignee. This reuses the same `assign` form action with the current user's ID:

```svelte
<!-- In src/lib/components/user/UserPicker.svelte or CardDetail.svelte -->
<script lang="ts">
  import { page } from "$app/stores";

  // Current user from session/page data
  let currentUser = $derived($page.data.user);
  let isSelfAssigned = $derived(currentAssignee?.id === currentUser?.id);
</script>

{#if currentUser && !isSelfAssigned}
  <form method="POST" action="?/assign" use:enhance>
    <input type="hidden" name="cardId" value={cardId} />
    <input type="hidden" name="userId" value={currentUser.id} />
    <Button variant="ghost" size="sm" class="w-full justify-start text-neutral-500">
      Assign to me
    </Button>
  </form>
{/if}
```

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/users.ts` | Users table schema and relations |
| `src/lib/db/schema/cards.ts` | Extended with `assigneeId` column and assignee relation |
| `src/lib/schemas/assignment.ts` | Zod validation schemas for assign/unassign forms |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | Board load includes `assignee` on cards and `users` list |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | `assign` and `unassign` form actions; card load includes assignee |
| `src/lib/components/user/UserAvatar.svelte` | Avatar with image or initials fallback |
| `src/lib/components/user/UserPicker.svelte` | Popover to assign/change/remove user from a card |
| `src/lib/components/card/CardItem.svelte` | Displays assignee avatar on board cards |
| `src/lib/components/card/CardDetail.svelte` | Includes UserPicker in sidebar |
