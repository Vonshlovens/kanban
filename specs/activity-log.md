# Activity Log

## Overview

An audit trail of actions taken on cards and the board, providing history and context. Activity is tracked via application-level logging — each mutation (card create, move, field change, comment add) inserts an `activity_log` row in the same transaction. Activity entries are loaded via Drizzle relations and displayed as a timeline component in the card detail view and as a board-level feed accessible from the board sidebar.

## Requirements

### Card Activity
- Each card tracks a chronological log of events:
  - Card created
  - Card moved between columns
  - Fields changed (title, description, due date, labels, assignee)
  - Comments added
- Each entry records the acting user and timestamp

### Board Activity
- Board-level activity feed showing recent actions across all cards
- Activities include card creation, movement, and deletion
- Paginated — load 50 entries at a time with "load more"

### Display
- Card activity is visible in the card detail view below comments
- Board-level activity is accessible from a board sidebar panel
- Activity entries are displayed in reverse chronological order
- Each entry shows an icon, description, acting user, and relative timestamp

## Database Schema

### Activity Log Table

The `activity_log` table in `src/lib/db/schema/activity-log.ts`:

```typescript
import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { cards } from "./cards";
import { boards } from "./boards";
import { users } from "./users";

export const activityLog = pgTable("activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").references(() => cards.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // "card.created" | "card.moved" | "card.updated" | "card.deleted" | "comment.added"
  metadata: jsonb("metadata").$type<ActivityMetadata>(), // action-specific details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityAction =
  | "card.created"
  | "card.moved"
  | "card.updated"
  | "card.deleted"
  | "comment.added";

export type ActivityMetadata =
  | { fromColumn: string; toColumn: string } // card.moved
  | { field: string; oldValue: string | null; newValue: string | null } // card.updated
  | { commentPreview: string } // comment.added
  | Record<string, never>; // card.created, card.deleted
```

### Relations

```typescript
import { relations } from "drizzle-orm";
import { activityLog } from "./activity-log";
import { cards } from "./cards";
import { boards } from "./boards";
import { users } from "./users";

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  board: one(boards, { fields: [activityLog.boardId], references: [boards.id] }),
  card: one(cards, { fields: [activityLog.cardId], references: [cards.id] }),
  user: one(users, { fields: [activityLog.userId], references: [users.id] }),
}));
```

The `cardsRelations` in `src/lib/db/schema/cards.ts` should include activity entries:

```typescript
export const cardsRelations = relations(cards, ({ one, many }) => ({
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  cardLabels: many(cardLabels),
  comments: many(comments),
  activityLog: many(activityLog),
}));
```

The `boardsRelations` in `src/lib/db/schema/boards.ts` should include activity entries:

```typescript
export const boardsRelations = relations(boards, ({ many }) => ({
  columns: many(columns),
  labels: many(labels),
  activityLog: many(activityLog),
}));
```

## Validation Schemas

Zod schemas in `src/lib/schemas/activity.ts` — used for the board-level activity feed pagination:

```typescript
import { z } from "zod/v4";

export const loadMoreActivitySchema = z.object({
  boardId: z.string().uuid(),
  cursor: z.string().datetime().optional(), // ISO timestamp for cursor-based pagination
  limit: z.number().int().min(1).max(100).default(50),
});
```

## Activity Logger

A server-side utility that inserts activity entries. Called from form actions and server load mutations within the same transaction:

```typescript
// src/lib/server/activity.ts
import { db } from "$lib/db";
import { activityLog, type ActivityAction, type ActivityMetadata } from "$lib/db/schema/activity-log";

export async function logActivity(
  params: {
    boardId: string;
    cardId?: string;
    userId?: string;
    action: ActivityAction;
    metadata?: ActivityMetadata;
  },
  tx?: typeof db,
) {
  const conn = tx ?? db;
  await conn.insert(activityLog).values({
    boardId: params.boardId,
    cardId: params.cardId ?? null,
    userId: params.userId ?? null,
    action: params.action,
    metadata: params.metadata ?? {},
  });
}
```

Usage in form actions (example — card move):

```typescript
// Inside a form action that moves a card
await db.transaction(async (tx) => {
  await tx.update(cards)
    .set({ columnId: newColumnId, position: newPosition })
    .where(eq(cards.id, cardId));

  await logActivity({
    boardId,
    cardId,
    userId: locals.user.id,
    action: "card.moved",
    metadata: { fromColumn: oldColumnName, toColumn: newColumnName },
  }, tx);
});
```

## Routes

| Route | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | Card detail load includes card activity entries |
| `src/routes/(app)/boards/[boardId]/activity/+server.ts` | GET endpoint for board-level activity feed with cursor pagination |

## Server Load Functions

### Card Detail Page (Activity Included)

The card detail load includes activity entries with their acting user, ordered reverse-chronologically:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (load)
export const load: PageServerLoad = async ({ params }) => {
  const card = await db.query.cards.findFirst({
    where: (cards, { eq }) => eq(cards.id, params.cardId),
    with: {
      cardLabels: { with: { label: true } },
      comments: {
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
        with: { author: true },
      },
      activityLog: {
        orderBy: (log, { desc }) => [desc(log.createdAt)],
        with: { user: true },
      },
    },
  });

  if (!card) throw error(404, "Card not found");
  return { card, boardId: params.boardId };
};
```

### Board Activity Feed (API Endpoint)

A GET endpoint returning paginated board-level activity:

```typescript
// src/routes/(app)/boards/[boardId]/activity/+server.ts
import { json } from "@sveltejs/kit";
import { db } from "$lib/db";
import { activityLog } from "$lib/db/schema/activity-log";
import { and, desc, eq, lt } from "drizzle-orm";

export const GET: RequestHandler = async ({ params, url }) => {
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const conditions = [eq(activityLog.boardId, params.boardId)];
  if (cursor) {
    conditions.push(lt(activityLog.createdAt, new Date(cursor)));
  }

  const entries = await db.query.activityLog.findMany({
    where: and(...conditions),
    orderBy: [desc(activityLog.createdAt)],
    limit: limit + 1, // fetch one extra to detect hasMore
    with: {
      user: true,
      card: true,
    },
  });

  const hasMore = entries.length > limit;
  const results = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? results[results.length - 1].createdAt.toISOString() : null;

  return json({ entries: results, nextCursor });
};
```

## Component Patterns

### Activity Item

A single activity entry displaying an icon, description, user, and relative timestamp:

```svelte
<!-- src/lib/components/activity/ActivityItem.svelte -->
<script lang="ts">
  import {
    Plus,
    ArrowRight,
    Pencil,
    Trash2,
    MessageSquare,
  } from "@lucide/svelte";
  import type { ActivityAction } from "$lib/db/schema/activity-log";

  let { entry }: {
    entry: {
      id: string;
      action: ActivityAction;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      user: { id: string; name: string } | null;
      card: { id: string; title: string } | null;
    };
  } = $props();

  const iconMap: Record<ActivityAction, typeof Plus> = {
    "card.created": Plus,
    "card.moved": ArrowRight,
    "card.updated": Pencil,
    "card.deleted": Trash2,
    "comment.added": MessageSquare,
  };

  let Icon = $derived(iconMap[entry.action] ?? Plus);
  let userName = $derived(entry.user?.name ?? "Unknown");

  let description = $derived.by(() => {
    const card = entry.card?.title ?? "a card";
    const meta = entry.metadata as Record<string, string> | null;
    switch (entry.action) {
      case "card.created":
        return `${userName} created "${card}"`;
      case "card.moved":
        return `${userName} moved "${card}" from ${meta?.fromColumn} to ${meta?.toColumn}`;
      case "card.updated":
        return `${userName} updated ${meta?.field ?? "a field"} on "${card}"`;
      case "card.deleted":
        return `${userName} deleted a card`;
      case "comment.added":
        return `${userName} commented on "${card}"`;
      default:
        return `${userName} performed an action`;
    }
  });

  let relativeTime = $derived.by(() => {
    const diff = Date.now() - entry.createdAt.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  });
</script>

<div class="flex items-start gap-3 py-2">
  <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
    <Icon class="h-3 w-3 text-neutral-500" />
  </div>
  <div class="flex-1 min-w-0">
    <p class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{description}</p>
    <span class="text-xs text-neutral-400">{relativeTime}</span>
  </div>
</div>
```

### Card Activity Timeline

Displays activity entries for a specific card in the card detail view:

```svelte
<!-- src/lib/components/activity/CardActivityTimeline.svelte -->
<script lang="ts">
  import { History } from "@lucide/svelte";
  import ActivityItem from "$lib/components/activity/ActivityItem.svelte";
  import type { ActivityAction } from "$lib/db/schema/activity-log";

  let { entries }: {
    entries: Array<{
      id: string;
      action: ActivityAction;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      user: { id: string; name: string } | null;
      card: { id: string; title: string } | null;
    }>;
  } = $props();
</script>

<div class="space-y-1">
  <div class="flex items-center gap-2">
    <History class="h-4 w-4 text-neutral-500" />
    <h3 class="text-sm font-medium">Activity</h3>
  </div>

  {#if entries.length === 0}
    <p class="py-4 text-center text-sm text-neutral-400">No activity yet</p>
  {:else}
    <div class="divide-y divide-neutral-100 dark:divide-neutral-800">
      {#each entries as entry (entry.id)}
        <ActivityItem {entry} />
      {/each}
    </div>
  {/if}
</div>
```

### Board Activity Panel

A sidebar panel for the board-level activity feed with infinite scroll:

```svelte
<!-- src/lib/components/activity/BoardActivityPanel.svelte -->
<script lang="ts">
  import { History, Loader2 } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import ActivityItem from "$lib/components/activity/ActivityItem.svelte";

  let { boardId }: { boardId: string } = $props();

  let entries = $state<Array<Record<string, unknown>>>([]);
  let nextCursor = $state<string | null>(null);
  let loading = $state(false);
  let initialized = $state(false);

  async function loadEntries(cursor?: string) {
    loading = true;
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`/boards/${boardId}/activity?${params}`);
    const data = await res.json();

    entries = cursor ? [...entries, ...data.entries] : data.entries;
    nextCursor = data.nextCursor;
    loading = false;
    initialized = true;
  }

  $effect(() => {
    loadEntries();
  });
</script>

<div class="flex h-full flex-col">
  <div class="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
    <History class="h-4 w-4" />
    <h2 class="text-sm font-semibold">Board Activity</h2>
  </div>

  <div class="flex-1 overflow-y-auto px-4 py-2">
    {#if !initialized && loading}
      <div class="flex justify-center py-8">
        <Loader2 class="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    {:else if entries.length === 0}
      <p class="py-8 text-center text-sm text-neutral-400">No activity yet</p>
    {:else}
      <div class="divide-y divide-neutral-100 dark:divide-neutral-800">
        {#each entries as entry (entry.id)}
          <ActivityItem {entry} />
        {/each}
      </div>
      {#if nextCursor}
        <div class="py-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onclick={() => loadEntries(nextCursor!)}
          >
            {#if loading}
              <Loader2 class="mr-1.5 h-3 w-3 animate-spin" />
            {/if}
            Load more
          </Button>
        </div>
      {/if}
    {/if}
  </div>
</div>
```

### Card Detail Integration

Add `CardActivityTimeline` to the card detail view below comments:

```svelte
<!-- In src/lib/components/card/CardDetail.svelte -->
<script lang="ts">
  import CardActivityTimeline from "$lib/components/activity/CardActivityTimeline.svelte";
  // ... existing imports
</script>

<!-- Below the comments section -->
<CardActivityTimeline entries={card.activityLog} />
```

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/activity-log.ts` | Activity log table schema, types, and relations |
| `src/lib/schemas/activity.ts` | Zod validation schema for activity feed pagination |
| `src/lib/server/activity.ts` | `logActivity` helper — inserts entries from form actions |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | Card detail load includes activity log entries with user |
| `src/routes/(app)/boards/[boardId]/activity/+server.ts` | GET endpoint for board-level activity feed with cursor pagination |
| `src/lib/components/activity/ActivityItem.svelte` | Single activity entry display (icon, description, timestamp) |
| `src/lib/components/activity/CardActivityTimeline.svelte` | Card-scoped activity timeline for card detail view |
| `src/lib/components/activity/BoardActivityPanel.svelte` | Board-level activity sidebar panel with infinite scroll |
| `src/lib/components/card/CardDetail.svelte` | Includes CardActivityTimeline below comments |
