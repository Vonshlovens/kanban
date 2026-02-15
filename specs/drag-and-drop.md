# Drag and Drop

## Overview

Drag and drop is the primary interaction model for moving cards between columns and reordering columns on the board. The implementation uses `svelte-dnd-action` — a Svelte action-based library that handles pointer events, touch support, keyboard accessibility, and screen reader announcements out of the box. Server persistence uses the existing JSON API reorder endpoints.

### Why svelte-dnd-action

- **Svelte-native:** Works as a Svelte action (`use:dndzone`), no wrapper components needed
- **Svelte 5 compatible:** Works with runes mode and `$state` arrays
- **Accessibility built-in:** Keyboard drag-and-drop and ARIA live announcements included
- **Touch support:** Mobile drag works without extra configuration
- **Animation:** Flip animations are built in via `flipDurationMs`

## Requirements

### Card Dragging
- User can pick up a card by clicking/touching and holding
- A visual preview of the card follows the cursor during drag
- Drop targets (columns and positions between cards) are clearly highlighted
- Dropping a card in a valid target moves it to that position
- Dropping a card outside a valid target returns it to its original position

### Column Dragging
- User can drag columns to reorder them
- Column dragging uses the column header as the grab handle
- Other columns shift to indicate the drop position

### Visual Feedback
- The dragged item has a distinct visual state (e.g., slight rotation, shadow, reduced opacity at origin)
- Valid drop zones are highlighted on hover
- Smooth animation accompanies card/column repositioning

### Accessibility
- Keyboard-based alternative for drag and drop (e.g., select card, use arrow keys or a "move to" action)
- Screen reader announcements for drag start, position changes, and drop completion

## Library

**Package:** `svelte-dnd-action`

```bash
deno add npm:svelte-dnd-action
```

### Core API

The library provides a single Svelte action `dndzone` and event types:

```typescript
import { dndzone, TRIGGERS, SOURCES } from "svelte-dnd-action";
import type { DndEvent } from "svelte-dnd-action";
```

Key options passed to `use:dndzone`:
- `items` — the array of objects (each must have an `id` property)
- `flipDurationMs` — animation duration for FLIP transitions (default 200)
- `type` — string type identifier to scope drag zones (cards vs columns)
- `dropTargetStyle` — CSS styles applied to active drop zones
- `dragDisabled` — boolean to conditionally disable dragging

Events:
- `onconsider` — fires during drag (items reorder optimistically)
- `onfinalize` — fires on drop (commit the reorder to server)

## Component Patterns

### Board View (Column DnD Zone)

The board page wraps columns in a `dndzone` for column reordering. Each column is itself a `dndzone` for card reordering.

```svelte
<!-- src/lib/components/board/BoardView.svelte -->
<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import type { DndEvent } from "svelte-dnd-action";
  import Column from "$lib/components/column/Column.svelte";
  import AddColumn from "$lib/components/column/AddColumn.svelte";
  import type { Board } from "$lib/types";

  let { board }: { board: Board } = $props();

  const FLIP_MS = 200;

  let columns = $state(board.columns);

  function handleColumnConsider(e: CustomEvent<DndEvent>) {
    columns = e.detail.items as typeof columns;
  }

  async function handleColumnFinalize(e: CustomEvent<DndEvent>) {
    columns = e.detail.items as typeof columns;

    await fetch(`/boards/${board.id}/columns/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columnIds: columns.map((c) => c.id),
      }),
    });
  }
</script>

<div
  class="flex h-full gap-4 overflow-x-auto p-4"
  use:dndzone={{
    items: columns,
    flipDurationMs: FLIP_MS,
    type: "columns",
    dropTargetStyle: { outline: "2px solid oklch(0.65 0.15 250)" },
  }}
  onconsider={handleColumnConsider}
  onfinalize={handleColumnFinalize}
>
  {#each columns as column (column.id)}
    <Column {column} boardId={board.id} />
  {/each}
</div>

<AddColumn />
```

### Column Component (Card DnD Zone)

Each column is a drop zone for cards. Cards can be dragged between columns.

```svelte
<!-- src/lib/components/column/Column.svelte -->
<script lang="ts">
  import { dndzone } from "svelte-dnd-action";
  import type { DndEvent } from "svelte-dnd-action";
  import type { Column, Card } from "$lib/types";
  import ColumnHeader from "./ColumnHeader.svelte";
  import ColumnFooter from "./ColumnFooter.svelte";
  import CardItem from "$lib/components/card/CardItem.svelte";

  let { column, boardId }: { column: Column & { cards: Card[] }; boardId: string } = $props();

  const FLIP_MS = 200;

  let cards = $state(column.cards);

  let isOverWipLimit = $derived(
    column.wipLimit != null && cards.length > column.wipLimit
  );
  let isAtWipLimit = $derived(
    column.wipLimit != null && cards.length === column.wipLimit
  );

  function handleCardConsider(e: CustomEvent<DndEvent>) {
    cards = e.detail.items as typeof cards;
  }

  async function handleCardFinalize(e: CustomEvent<DndEvent>) {
    cards = e.detail.items as typeof cards;

    await fetch(`/boards/${boardId}/cards/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardIds: cards.map((c) => c.id),
      }),
    });
  }
</script>

<div
  class="flex h-full w-80 shrink-0 flex-col rounded-xl bg-neutral-100 dark:bg-neutral-900"
  class:ring-2={isOverWipLimit}
  class:ring-amber-500={isOverWipLimit}
>
  <ColumnHeader {column} cardCount={cards.length} />

  <div
    class="flex-1 space-y-2 overflow-y-auto p-2"
    use:dndzone={{
      items: cards,
      flipDurationMs: FLIP_MS,
      type: "cards",
      dropTargetStyle: { outline: "2px dashed oklch(0.65 0.15 250)", borderRadius: "0.75rem" },
    }}
    onconsider={handleCardConsider}
    onfinalize={handleCardFinalize}
  >
    {#each cards as card (card.id)}
      <CardItem {card} {boardId} />
    {/each}
  </div>

  <ColumnFooter {column} {isAtWipLimit} {isOverWipLimit} />
</div>
```

### Drag Handle for Columns

Column dragging uses the header's grip icon as a handle. `svelte-dnd-action` supports this via the `data-dnd-handle` attribute or by using the `dragDisabled` option and manually calling the drag trigger.

The simplest approach: wrap the grab icon in the column header with a drag handle marker:

```svelte
<!-- In ColumnHeader.svelte -->
<div class="flex items-center gap-2 px-3 pt-3 pb-1">
  <GripVertical
    class="h-4 w-4 shrink-0 cursor-grab text-neutral-400 active:cursor-grabbing"
    data-dnd-handle
  />
  <!-- ... rest of header -->
</div>
```

### Card Item Drag Styles

During drag, `svelte-dnd-action` applies a CSS class to the shadow element. Style the dragged card with a slight transform and elevated shadow:

```css
/* src/app.css or a global stylesheet */
:global([aria-grabbed="true"]) {
  transform: rotate(2deg);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.2);
  opacity: 0.9;
}

:global(.dnd-shadow-placeholder) {
  opacity: 0.4;
  border: 2px dashed oklch(0.65 0.15 250);
  background: oklch(0.95 0.02 250);
  border-radius: 0.75rem;
}
```

## Cross-Column Card Moves

When a card is dropped in a different column, both the reorder and the column assignment must be persisted. The `onfinalize` handler on each column detects whether a card was added from another column by checking the `info` property:

```typescript
import { SOURCES, TRIGGERS } from "svelte-dnd-action";

async function handleCardFinalize(e: CustomEvent<DndEvent>) {
  cards = e.detail.items as typeof cards;
  const { source, trigger } = e.detail.info;

  // Always persist the new order within this column
  await fetch(`/boards/${boardId}/cards/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardIds: cards.map((c) => c.id),
    }),
  });

  // If a card was dropped here from another column, also update its columnId
  if (source === SOURCES.POINTER || source === SOURCES.KEYBOARD) {
    const droppedCard = cards.find((c) => !column.cards.some((oc) => oc.id === c.id));
    if (droppedCard) {
      const position = cards.indexOf(droppedCard);
      await fetch(`/boards/${boardId}?/moveCard`, {
        method: "POST",
        body: new FormData(Object.entries({
          cardId: droppedCard.id,
          targetColumnId: column.id,
          position: String(position),
        }).reduce((fd, [k, v]) => { fd.append(k, v); return fd; }, new FormData())),
      });
    }
  }
}
```

**Note:** The reorder endpoint already handles position updates. The `moveCard` form action handles the column reassignment. Both fire on cross-column drops to ensure the card's `columnId` and `position` are correct.

## Keyboard Accessibility

`svelte-dnd-action` provides built-in keyboard support:

- **Enter/Space** on a draggable item: starts keyboard drag mode
- **Arrow keys**: move the item within the zone or between zones of the same `type`
- **Enter/Space** again: drops the item
- **Escape**: cancels the drag

Screen reader announcements are automatic via an ARIA live region that `svelte-dnd-action` injects into the DOM.

### "Move To" Dialog (Alternative)

For users who prefer a non-drag interface, a "Move to" action in the card's context menu provides an explicit column picker:

```svelte
<!-- src/lib/components/card/MoveCardDialog.svelte -->
<script lang="ts">
  import type { Card, Column } from "$lib/types";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";

  let { card, columns, boardId, open = $bindable(false) }: {
    card: Card;
    columns: Column[];
    boardId: string;
    open: boolean;
  } = $props();

  let targetColumnId = $state<string | undefined>(undefined);
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Move "{card.title}"</Dialog.Title>
      <Dialog.Description>Select the destination column.</Dialog.Description>
    </Dialog.Header>

    <Select.Root onSelectedChange={(v) => targetColumnId = v?.value}>
      <Select.Trigger>
        <Select.Value placeholder="Select column..." />
      </Select.Trigger>
      <Select.Content>
        {#each columns as col}
          <Select.Item value={col.id} disabled={col.id === card.columnId}>
            {col.name}
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => open = false}>Cancel</Button>
      <form method="POST" action="/boards/{boardId}?/moveCard">
        <input type="hidden" name="cardId" value={card.id} />
        <input type="hidden" name="targetColumnId" value={targetColumnId ?? ""} />
        <input type="hidden" name="position" value="0" />
        <Button type="submit" disabled={!targetColumnId}>Move</Button>
      </form>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

## API Endpoints

Drag-and-drop reordering uses existing JSON API endpoints (defined in the columns and cards specs):

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `boards/[boardId]/columns/reorder` | `PUT` | Persist column order after drag |
| `boards/[boardId]/cards/reorder` | `PUT` | Persist card order within a column |
| Board page `?/moveCard` form action | `POST` | Update a card's column assignment |

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/components/board/BoardView.svelte` | Board layout with column dndzone |
| `src/lib/components/column/Column.svelte` | Column container with card dndzone |
| `src/lib/components/column/ColumnHeader.svelte` | Drag handle for column reorder |
| `src/lib/components/card/CardItem.svelte` | Draggable card in column |
| `src/lib/components/card/MoveCardDialog.svelte` | Keyboard/mouse "Move to" alternative |
| `src/app.css` | Global drag-and-drop visual styles |
| `src/routes/(app)/boards/[boardId]/columns/reorder/+server.ts` | Column reorder API |
| `src/routes/(app)/boards/[boardId]/cards/reorder/+server.ts` | Card reorder API |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | `moveCard` form action |
