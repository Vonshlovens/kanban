# Comments

## Overview

Users can add comments to cards to discuss work items, ask questions, and provide updates. Comments belong to a card and an author (user). Comment CRUD uses SvelteKit form actions on the card detail page, with Drizzle ORM for database access. Comments display in chronological order as plain text. Rich text support (bold, italic, links, lists) is not yet implemented — see backlog.

## Requirements

### Add Comment
- User can add a text comment to any card
- Comments are added from the card detail view
- Keyboard shortcut: Cmd/Ctrl+Enter to submit

### Edit Comment
- User can edit their own comments
- Edited comments show an "(edited)" indicator (compares `updatedAt > createdAt + 1s`)
- Inline edit mode with Save/Cancel buttons and Escape to cancel

### Delete Comment
- User can delete their own comments
- Deletion uses a two-click confirmation: first click shows a red delete icon, second click confirms
- The confirmation resets on blur after 200ms

### Display
- Comments are displayed in chronological order within the card detail view
- Each comment shows the author initials (circular avatar), author name, timestamp, and content
- Comments section header shows count: "Comments (N)"
- Toast notifications for create, update, and delete success/error

## Database Schema

### Comments Table

> **Status:** Implemented.

The `comments` table in `src/lib/db/schema/comments.ts`:

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { cards } from "./cards";
import { users } from "./users";

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Relations

```typescript
import { relations } from "drizzle-orm";
import { comments } from "./comments";
import { cards } from "./cards";
import { users } from "./users";

export const commentsRelations = relations(comments, ({ one }) => ({
  card: one(cards, { fields: [comments.cardId], references: [cards.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));
```

The `cardsRelations` in `src/lib/db/schema/cards.ts` already includes comments — see `specs/cards.md`:

```typescript
export const cardsRelations = relations(cards, ({ one, many }) => ({
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  cardLabels: many(cardLabels),
  comments: many(comments),
}));
```

The `usersRelations` in `src/lib/db/schema/users.ts` includes authored comments:

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  assignedCards: many(cards),
  comments: many(comments),
}));
```

## Validation Schemas

> **Status:** Implemented.

Zod schemas in `src/lib/schemas/comment.ts`:

```typescript
import { z } from "zod/v4";

export const createCommentSchema = z.object({
  cardId: z.string().uuid(),
  content: z.string().min(1, "Comment cannot be empty").max(10000),
});

export const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  content: z.string().min(1, "Comment cannot be empty").max(10000),
});

export const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});
```

## Routes

| Route | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | `createComment`, `updateComment`, `deleteComment` form actions |

## Server Load Functions

### Card Detail Page (Comments Included)

> **Status:** Implemented.

The card detail load includes comments with their authors, ordered chronologically. It also fetches the current user ID for permission checks (using `getDefaultUser()` until real auth is implemented):

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (load)
export const load: PageServerLoad = async ({ params }) => {
  const [card, currentUser] = await Promise.all([
    db.query.cards.findFirst({
      where: (cards, { eq }) => eq(cards.id, params.cardId),
      with: {
        column: true,
        cardLabels: { with: { label: true } },
        comments: {
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
          with: { author: true },
        },
      },
    }),
    getDefaultUser(),
  ]);

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

  return {
    card,
    boardId: params.boardId,
    columns: boardColumns,
    updateForm,
    currentUserId: currentUser.id,
  };
};
```

## Form Actions

### Comment CRUD (Card Detail Page)

> **Status:** Implemented.

Create, update, and delete comments on the card detail page. Uses `getDefaultUser()` for author identity (to be replaced with real auth):

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (actions)
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { createCommentSchema, updateCommentSchema, deleteCommentSchema } from "$lib/schemas/comment";
import { comments } from "$lib/db/schema/comments";
import { eq } from "drizzle-orm";
import { getDefaultUser } from "$lib/server/auth";

export const actions: Actions = {
  // ... existing actions (update, deleteCard)

  createComment: async ({ request }) => {
    const form = await superValidate(request, zod4(createCommentSchema));
    if (!form.valid) return fail(400, { form });

    const user = await getDefaultUser();

    await db.insert(comments).values({
      cardId: form.data.cardId,
      authorId: user.id,
      content: form.data.content,
    });

    return { form };
  },

  updateComment: async ({ request }) => {
    const form = await superValidate(request, zod4(updateCommentSchema));
    if (!form.valid) return fail(400, { form });

    const user = await getDefaultUser();
    const comment = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, form.data.commentId),
    });

    if (!comment || comment.authorId !== user.id) {
      return fail(403, { form });
    }

    await db.update(comments)
      .set({ content: form.data.content, updatedAt: new Date() })
      .where(eq(comments.id, form.data.commentId));

    return { form };
  },

  deleteComment: async ({ request }) => {
    const form = await superValidate(request, zod4(deleteCommentSchema));
    if (!form.valid) return fail(400, { form });

    const user = await getDefaultUser();
    const comment = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, form.data.commentId),
    });

    if (!comment || comment.authorId !== user.id) {
      return fail(403, { form });
    }

    await db.delete(comments).where(eq(comments.id, form.data.commentId));

    return { form };
  },
};
```

## Component Patterns

### Comment Item

> **Status:** Implemented.

A single comment displaying author initials avatar, timestamp, content, and edit/delete controls for the author. Uses inline initials in a circular badge (no separate `UserAvatar` component).

Key implementation details:
- Uses `group/comment` hover group for showing edit/delete action buttons
- Author initials derived from `comment.author.name`, shown in a circular `bg-muted` badge
- "Edited" indicator uses a 1-second threshold (`updatedAt > createdAt + 1000ms`) to avoid false positives from near-simultaneous timestamps
- Delete uses two-click confirmation: first click toggles `confirmingDelete`, second click submits the form
- Confirmation resets on blur after 200ms timeout
- Loading spinner on delete button during submission
- Toast notifications for success/error

```svelte
<!-- src/lib/components/comment/CommentItem.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Pencil, Trash2 } from "@lucide/svelte";
  import UserAvatar from "$lib/components/user/UserAvatar.svelte";
  import { enhance } from "$app/forms";

  let { comment, currentUserId, onEdit }: {
    comment: {
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      author: { id: string; name: string; avatarUrl?: string | null };
    };
    currentUserId?: string;
    onEdit: (commentId: string, content: string) => void;
  } = $props();

  let isAuthor = $derived(currentUserId === comment.author.id);
  let isEdited = $derived(
    comment.updatedAt.getTime() > comment.createdAt.getTime(),
  );
  let confirmingDelete = $state(false);
</script>

<div class="group flex gap-3 rounded-lg p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
  <UserAvatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} size="md" />
  <div class="flex-1 space-y-1">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium">{comment.author.name}</span>
      <span class="text-xs text-neutral-500">
        {comment.createdAt.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
      {#if isEdited}
        <span class="text-xs text-neutral-400">(edited)</span>
      {/if}
    </div>
    <div class="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
      {comment.content}
    </div>
  </div>

  {#if isAuthor}
    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        onclick={() => onEdit(comment.id, comment.content)}
      >
        <Pencil class="h-3 w-3" />
      </Button>
      {#if confirmingDelete}
        <form method="POST" action="?/deleteComment" use:enhance>
          <input type="hidden" name="commentId" value={comment.id} />
          <Button type="submit" variant="ghost" size="icon" class="h-7 w-7 text-red-500">
            <Trash2 class="h-3 w-3" />
          </Button>
        </form>
      {:else}
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-neutral-400"
          onclick={() => confirmingDelete = true}
        >
          <Trash2 class="h-3 w-3" />
        </Button>
      {/if}
    </div>
  {/if}
</div>
```

### Comment List

> **Status:** Implemented.

Displays all comments in chronological order with inline editing and a new comment form. The comment count header and `MessageSquareIcon` are rendered by the parent `CardDetail` component.

Key implementation details:
- Inline edit mode: clicking edit on a `CommentItem` shows the textarea in place of the comment
- Edit form includes the author's initials avatar alongside the textarea for visual continuity
- New comment form at the bottom with a textarea and send button
- Keyboard shortcuts: `Cmd/Ctrl+Enter` to submit new comment, `Escape` to cancel edit
- Loading states on both edit save and new comment submit buttons
- Toast notifications: "Comment added", "Comment updated", "Comment deleted" / error variants
- Submit buttons disabled when content is empty or during submission
- Uses `cn()` utility for textarea styling consistent with shadcn-svelte theme

```svelte
<!-- src/lib/components/comment/CommentList.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { MessageSquare, Send } from "@lucide/svelte";
  import CommentItem from "$lib/components/comment/CommentItem.svelte";
  import { enhance } from "$app/forms";

  let { cardId, comments, currentUserId }: {
    cardId: string;
    comments: Array<{
      id: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      author: { id: string; name: string; avatarUrl?: string | null };
    }>;
    currentUserId?: string;
  } = $props();

  let newComment = $state("");
  let editingId = $state<string | null>(null);
  let editContent = $state("");

  function startEdit(commentId: string, content: string) {
    editingId = commentId;
    editContent = content;
  }

  function cancelEdit() {
    editingId = null;
    editContent = "";
  }
</script>

<div class="space-y-4">
  <div class="flex items-center gap-2">
    <MessageSquare class="h-4 w-4 text-neutral-500" />
    <h3 class="text-sm font-medium">Comments ({comments.length})</h3>
  </div>

  <!-- Comment list -->
  <div class="space-y-1">
    {#each comments as comment}
      {#if editingId === comment.id}
        <form
          method="POST"
          action="?/updateComment"
          use:enhance={() => {
            return async ({ update }) => {
              await update();
              cancelEdit();
            };
          }}
          class="flex gap-2 p-3"
        >
          <input type="hidden" name="commentId" value={comment.id} />
          <textarea
            name="content"
            bind:value={editContent}
            class="flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700"
            rows="3"
          ></textarea>
          <div class="flex flex-col gap-1">
            <Button type="submit" size="sm">Save</Button>
            <Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
          </div>
        </form>
      {:else}
        <CommentItem {comment} {currentUserId} onEdit={startEdit} />
      {/if}
    {/each}
  </div>

  <!-- New comment form -->
  <form
    method="POST"
    action="?/createComment"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
        newComment = "";
      };
    }}
    class="flex gap-2"
  >
    <input type="hidden" name="cardId" value={cardId} />
    <textarea
      name="content"
      bind:value={newComment}
      placeholder="Write a comment..."
      class="flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700"
      rows="2"
    ></textarea>
    <Button type="submit" size="icon" disabled={!newComment.trim()}>
      <Send class="h-4 w-4" />
    </Button>
  </form>
</div>
```

### Card Detail Integration

> **Status:** Implemented.

`CommentList` is rendered inside a Card section in `CardDetail.svelte`, below the labels and metadata sections:

```svelte
<!-- In src/lib/components/card/CardDetail.svelte -->
<script lang="ts">
  import CommentList from "$lib/components/comment/CommentList.svelte";
  // ... existing imports
</script>

<!-- Inside a Card.Root > Card.Content section -->
<CommentList cardId={card.id} comments={card.comments} {currentUserId} />
```

The `currentUserId` is passed from the page server load through the page component as a prop to `CardDetail`.

### CardItem Integration

> **Status:** Implemented.

The board-level card shows a comment count indicator. The board page load function (`src/routes/(app)/boards/[boardId]/+page.server.ts`) includes a lightweight comments query that fetches only comment IDs (not full content) for efficient counting:

```typescript
// In the board page load, nested within the cards query:
comments: { columns: { id: true } },
```

`CardItem.svelte` derives the count from the resulting array:

```svelte
<!-- In src/lib/components/card/CardItem.svelte -->
<script lang="ts">
  import { MessageSquare } from "@lucide/svelte";
  // ... existing imports

  let commentCount = $derived(card.comments?.length ?? 0);
</script>

<!-- In the card footer area, alongside label badges and due date -->
{#if commentCount > 0}
  <span class="flex items-center gap-1">
    <MessageSquare class="size-3" />
    {commentCount}
  </span>
{/if}
```

## Toast Notifications

Comment actions show toast notifications for user feedback:

| Action | Success Message | Error Message |
| --- | --- | --- |
| Add comment | "Comment added" | "Failed to add comment" |
| Edit comment | "Comment updated" | "Failed to update comment" |
| Delete comment | "Comment deleted" | "Failed to delete comment" |

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/comments.ts` | Comments table schema and relations |
| `src/lib/schemas/comment.ts` | Zod validation schemas for comment forms |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | `createComment`, `updateComment`, `deleteComment` form actions; card load includes comments with authors |
| `src/lib/components/comment/CommentItem.svelte` | Single comment display with edit/delete controls |
| `src/lib/components/comment/CommentList.svelte` | Chronological comment list with new comment form |
| `src/lib/components/card/CardDetail.svelte` | Includes CommentList in a Card section |
| `src/lib/components/card/CardItem.svelte` | Displays comment count indicator on board cards |
| `src/lib/server/auth.ts` | `getDefaultUser()` — temporary mock auth for comment author identity |
