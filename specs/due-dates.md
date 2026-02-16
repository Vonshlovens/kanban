# Due Dates

## Overview

Cards can have due dates to track deadlines and surface time-sensitive work. Due dates are stored as a nullable timestamp on the `cards` table. A date picker (via `bits-ui`) lets users set or clear the date from the card detail view. Urgency indicators on the board are computed as derived state from the current time and the card's column.

## Requirements

### Set Due Date
- User can set a due date on any card
- Date is selected via a date picker (bits-ui `DatePicker`)
- Due date is optional

### Edit Due Date
- User can change or remove a due date
- Clearing the date sets it to `null`

### Visual Indicators
- Cards with due dates display the date on the card in the board view
- Visual urgency states:
  - **Overdue**: distinct warning style (red) for cards past their due date
  - **Due soon**: subtle alert style (amber) for cards due within 24 hours
  - **Upcoming**: neutral style for cards with future due dates
  - **Complete**: if a card is in a "done" column, the due date indicator reflects completion regardless of date

### Sorting
- Within a column, user can optionally sort cards by due date

## Database Schema

The `dueDate` field is a nullable timestamp on the existing `cards` table in `src/lib/db/schema/cards.ts`:

```typescript
import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { columns } from "./columns";

export const cards = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  columnId: uuid("column_id").notNull().references(() => columns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

No new tables are needed — `dueDate` extends the existing card schema.

## Validation Schemas

Add `dueDate` to the update card schema in `src/lib/schemas/card.ts`:

```typescript
import { z } from "zod/v4";

export const updateCardSchema = z.object({
  title: z.string().min(1, "Card title is required").max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});
```

A dedicated schema for the due-date-only update from the card detail sidebar:

```typescript
export const setDueDateSchema = z.object({
  dueDate: z.coerce.date().nullable(),
});
```

## Routes

Due date updates use the existing card update flow — no new routes are needed.

| Route | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | Existing `update` action handles `dueDate` field |

### Update Action (Extended)

The existing `update` form action on the card detail page already spreads `form.data` into the update — once `dueDate` is added to the Zod schema, it flows through automatically:

```typescript
// src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts (actions)
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

## Urgency Helpers

Urgency state is derived from the due date, current time, and column type. Define a helper in `src/lib/utils/due-date.ts`:

```typescript
export type DueStatus = "overdue" | "due-soon" | "upcoming" | "complete" | null;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function getDueStatus(
  dueDate: Date | string | null | undefined,
  isDoneColumn: boolean,
): DueStatus {
  if (!dueDate) return null;
  if (isDoneColumn) return "complete";

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diff = due.getTime() - now.getTime();

  if (diff < 0) return "overdue";
  if (diff < TWENTY_FOUR_HOURS_MS) return "due-soon";
  return "upcoming";
}

export const dueStatusStyles: Record<NonNullable<DueStatus>, string> = {
  overdue: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  "due-soon": "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  upcoming: "text-neutral-600 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800",
  complete: "text-green-600 bg-green-50 line-through dark:text-green-400 dark:bg-green-950",
};
```

## Component Patterns

### Due Date Badge (Board View)

A compact badge shown on `CardItem` in the board column view. Displays the formatted date with urgency styling.

```svelte
<!-- src/lib/components/card/DueDateBadge.svelte -->
<script lang="ts">
  import { Calendar, Check } from "@lucide/svelte";
  import { getDueStatus, dueStatusStyles, type DueStatus } from "$lib/utils/due-date";
  import { cn } from "$lib/utils";

  let { dueDate, isDoneColumn = false }: {
    dueDate: Date | string | null;
    isDoneColumn?: boolean;
  } = $props();

  let status: DueStatus = $derived(getDueStatus(dueDate, isDoneColumn));

  let formatted = $derived(
    dueDate ? new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null,
  );
</script>

{#if status && formatted}
  {@const Icon = status === "complete" ? Check : Calendar}
  <span class={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", dueStatusStyles[status])}>
    <Icon class="h-3 w-3" />
    {formatted}
  </span>
{/if}
```

### CardItem Integration

The existing `CardItem.svelte` replaces the plain date display with `DueDateBadge`:

```svelte
<!-- In src/lib/components/card/CardItem.svelte -->
<script lang="ts">
  import DueDateBadge from "$lib/components/card/DueDateBadge.svelte";
  // ... existing imports

  let { card, boardId, isDoneColumn = false }: {
    card: Card;
    boardId: string;
    isDoneColumn?: boolean;
  } = $props();
</script>

<!-- Replace the plain date span with: -->
{#if card.dueDate}
  <DueDateBadge dueDate={card.dueDate} {isDoneColumn} />
{/if}
```

### Date Picker (Card Detail View)

The card detail page uses a `bits-ui` `DatePicker` to set or clear the due date:

```svelte
<!-- src/lib/components/card/DueDatePicker.svelte -->
<script lang="ts">
  import { Calendar, X } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Popover from "$lib/components/ui/popover";
  import { Calendar as CalendarComponent } from "$lib/components/ui/calendar";
  import { getDueStatus, dueStatusStyles, type DueStatus } from "$lib/utils/due-date";
  import { cn } from "$lib/utils";
  import type { DateValue } from "@internationalized/date";
  import { CalendarDate, today, getLocalTimeZone } from "@internationalized/date";

  let { dueDate = $bindable(), isDoneColumn = false }: {
    dueDate: string | null;
    isDoneColumn?: boolean;
  } = $props();

  let status: DueStatus = $derived(getDueStatus(dueDate, isDoneColumn));

  let calendarValue: DateValue | undefined = $derived.by(() => {
    if (!dueDate) return undefined;
    const d = new Date(dueDate);
    return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  });

  let open = $state(false);

  function handleSelect(value: DateValue | undefined) {
    if (value) {
      const d = new Date(value.year, value.month - 1, value.day);
      dueDate = d.toISOString();
    }
    open = false;
  }

  function clear() {
    dueDate = null;
    open = false;
  }
</script>

<div class="space-y-1">
  <label class="text-sm font-medium text-neutral-500">Due Date</label>
  <Popover.Root bind:open>
    <Popover.Trigger>
      {#snippet child({ props })}
      <Button variant="outline" size="sm" {...props} class={cn("w-full justify-start", status && dueStatusStyles[status])}>
        <Calendar class="mr-2 h-4 w-4" />
        {#if dueDate}
          {new Date(dueDate).toLocaleDateString()}
        {:else}
          Set due date
        {/if}
      </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-auto p-0" align="start">
      <CalendarComponent
        value={calendarValue}
        onValueChange={handleSelect}
        initialFocus
      />
      {#if dueDate}
        <div class="border-t p-2">
          <Button variant="ghost" size="sm" class="w-full text-red-500" onclick={clear}>
            <X class="mr-2 h-3 w-3" />
            Remove due date
          </Button>
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
```

### Card Detail Integration

Add `DueDatePicker` to the card detail page sidebar:

```svelte
<!-- In src/lib/components/card/CardDetail.svelte -->
<script lang="ts">
  import DueDatePicker from "$lib/components/card/DueDatePicker.svelte";
  // ... existing imports
</script>

<!-- In the form or sidebar area -->
<form method="POST" action="?/update" use:enhance class="space-y-4">
  <DueDatePicker bind:dueDate={$form.dueDate} />
  <!-- ... existing fields -->
  <Button type="submit" size="sm">Save</Button>
</form>
```

## Column-Level Sorting by Due Date

Optional sorting within a column. The column component derives a sorted card list when sorting is active:

```typescript
// In Column.svelte or a utility
let sortByDueDate = $state(false);

let sortedCards = $derived.by(() => {
  if (!sortByDueDate) return cards;
  return [...cards].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
});
```

A toggle in the column header menu enables/disables due date sorting. This is client-side only and does not persist — it is a view-time convenience.

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/db/schema/cards.ts` | `dueDate` column on cards table |
| `src/lib/schemas/card.ts` | `dueDate` in update card Zod schema |
| `src/lib/utils/due-date.ts` | `getDueStatus` helper and urgency style map |
| `src/lib/components/card/DueDateBadge.svelte` | Compact urgency badge for board view |
| `src/lib/components/card/DueDatePicker.svelte` | Date picker popover for card detail |
| `src/lib/components/card/CardItem.svelte` | Uses `DueDateBadge` to display due date |
| `src/lib/components/card/CardDetail.svelte` | Uses `DueDatePicker` in sidebar |
| `src/routes/(app)/boards/[boardId]/cards/[cardId]/+page.server.ts` | Existing `update` action handles `dueDate` |
