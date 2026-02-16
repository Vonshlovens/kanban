# Drag and Drop

## Overview

Drag and drop is the primary interaction model for moving cards between columns and reordering columns on the board. The implementation uses `svelte-dnd-action` — a Svelte action-based library that handles pointer events, touch support, keyboard accessibility, and screen reader announcements out of the box. Server persistence uses JSON API reorder endpoints.

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
- Column dragging uses the column header grip icon as the drag handle
- Other columns shift to indicate the drop position

### Visual Feedback
- The dragged item has a distinct visual state (slight rotation, elevated shadow, reduced opacity)
- Shadow placeholders show where the item will land
- Smooth FLIP animation accompanies card/column repositioning (200ms)

### Accessibility
- Keyboard-based drag and drop via `svelte-dnd-action` built-in support (Enter/Space to grab, arrows to move, Enter/Space to drop, Escape to cancel)
- Screen reader announcements for drag start, position changes, and drop completion via ARIA live region

## Library

> **Status:** Installed.

**Package:** `svelte-dnd-action`

```bash
deno add npm:svelte-dnd-action
```

### Core API

The library provides actions and event types:

```typescript
import { dndzone, dragHandleZone, dragHandle, TRIGGERS, SOURCES } from "svelte-dnd-action";
import type { DndEvent } from "svelte-dnd-action";
```

Key options passed to `use:dndzone` or `use:dragHandleZone`:
- `items` — the array of objects (each must have an `id` property)
- `flipDurationMs` — animation duration for FLIP transitions (default 200)
- `type` — string type identifier to scope drag zones (cards vs columns)
- `dragDisabled` — boolean to conditionally disable dragging

Events (Svelte 5 syntax):
- `onconsider` — fires during drag (items reorder optimistically)
- `onfinalize` — fires on drop (commit the reorder to server)

### Drag Handle Pattern

For column dragging, we use `dragHandleZone` on the container and `dragHandle` on the grip icon element. This constrains the drag trigger to just the grip icon rather than the entire column:

```typescript
// Container: use dragHandleZone instead of dndzone
use:dragHandleZone={{ items, flipDurationMs, type: "columns" }}

// Inside each item: use dragHandle on the grip element
use:dragHandle
```

## Component Patterns

### Board Page (Column DnD Zone)

> **Status:** Implemented.

The board page (`+page.svelte`) uses `dragHandleZone` for column reordering. A local `$state` copy of `data.board.columns` is kept in sync via `$effect` so that `svelte-dnd-action` can mutate it during drag operations. The `AddColumn` component sits outside the dndzone so it is not treated as a draggable item.

Key implementation details:
- Uses `dragHandleZone` (not `dndzone`) so only the grip icon initiates column drag
- `$effect` syncs `columnItems` with server data after CRUD operations
- `handleColumnFinalize` sends `PUT /boards/{boardId}/columns/reorder` with the new column ID order

### Column Component (Card DnD Zone)

> **Status:** Implemented.

Each column uses `dndzone` on the card list container. Cards can be freely dragged within a column (reorder) or between columns (move). A Set of original card IDs is tracked to detect cross-column drops.

Key implementation details:
- Uses `dndzone` with `type: "cards"` so all columns share a drag scope
- `$effect` syncs `cardItems` and `originalCardIds` with server data
- `handleCardFinalize` always sends `PUT /boards/{boardId}/cards/reorder` for the new order
- For cross-column drops (detected via `TRIGGERS.DROPPED_INTO_ZONE` or `TRIGGERS.DROPPED_INTO_ANOTHER`), additionally calls `POST /boards/{boardId}?/moveCard` to update the card's `columnId`

### Drag Handle for Columns

> **Status:** Implemented.

The grip icon in `ColumnHeader.svelte` uses the `dragHandle` action from `svelte-dnd-action`. The icon is wrapped in a `<div use:dragHandle>` which constrains drag initiation to that element.

```svelte
<!-- In ColumnHeader.svelte -->
<div use:dragHandle aria-label="Drag to reorder column" class="shrink-0 cursor-grab ...">
  <GripVerticalIcon class="size-3.5 text-muted-foreground/50" />
</div>
```

### Card Item Drag Styles

> **Status:** Implemented.

Global CSS in `src/app.css` styles the dragged element and shadow placeholder:

```css
/* Dragged element */
[aria-grabbed="true"] {
  transform: rotate(2deg);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.2);
  opacity: 0.9;
  z-index: 50;
}

/* Shadow placeholder where item will land */
[data-is-dnd-shadow-item-hint] {
  opacity: 0.35;
  border: 2px dashed oklch(0.65 0.15 250);
  background: oklch(0.95 0.02 250);
  border-radius: 0.75rem;
}
```

Dark mode variants are also included.

## Cross-Column Card Moves

> **Status:** Implemented.

When a card is dropped in a different column, both the reorder and column assignment are persisted. The `onfinalize` handler detects cross-column drops by comparing current card IDs against a tracked set of original card IDs:

```typescript
async function handleCardFinalize(e: CustomEvent<DndEvent>) {
  cardItems = e.detail.items;
  const { trigger } = e.detail.info;

  // Always persist new order
  await fetch(`/boards/${boardId}/cards/reorder`, { ... });

  // Detect cross-column drop via trigger type
  if (trigger === TRIGGERS.DROPPED_INTO_ZONE || trigger === TRIGGERS.DROPPED_INTO_ANOTHER) {
    const droppedCard = cardItems.find((c) => !originalCardIds.has(c.id));
    if (droppedCard) {
      // Update card's columnId via moveCard form action
      await fetch(`/boards/${boardId}?/moveCard`, { method: "POST", body: fd });
    }
  }
}
```

## Keyboard Accessibility

`svelte-dnd-action` provides built-in keyboard support:

- **Enter/Space** on a draggable item: starts keyboard drag mode
- **Arrow keys**: move the item within the zone or between zones of the same `type`
- **Enter/Space** again: drops the item
- **Escape**: cancels the drag

Screen reader announcements are automatic via an ARIA live region that `svelte-dnd-action` injects into the DOM.

### "Move To" Dialog (Alternative)

> **Status:** Not yet implemented. Planned as a future enhancement.

A "Move to" action in the card's context menu would provide an explicit column picker for users who prefer a non-drag interface. This would use a Dialog with a Select component for choosing the target column.

## API Endpoints

> **Status:** All implemented.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `boards/[boardId]/columns/reorder` | `PUT` | Persist column order after drag |
| `boards/[boardId]/cards/reorder` | `PUT` | Persist card order within a column |
| Board page `?/moveCard` form action | `POST` | Update a card's column assignment |

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/routes/(app)/boards/[boardId]/+page.svelte` | Board layout with column dragHandleZone |
| `src/lib/components/column/Column.svelte` | Column container with card dndzone |
| `src/lib/components/column/ColumnHeader.svelte` | Drag handle for column reorder |
| `src/lib/components/card/CardItem.svelte` | Draggable card in column |
| `src/app.css` | Global drag-and-drop visual styles |
| `src/routes/(app)/boards/[boardId]/columns/reorder/+server.ts` | Column reorder API |
| `src/routes/(app)/boards/[boardId]/cards/reorder/+server.ts` | Card reorder API |
| `src/routes/(app)/boards/[boardId]/+page.server.ts` | `moveCard` form action |
