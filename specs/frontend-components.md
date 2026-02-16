# Frontend Components

## Overview

All UI components are Svelte 5 components using runes mode (`$state`, `$derived`, `$effect`). The component library is built on shadcn-svelte (which wraps bits-ui primitives) and styled with Tailwind CSS 4. There is no legacy/new split — one unified component set.

## Component Hierarchy

Components are organized into four tiers by responsibility.

| Tier | Location | Role |
| --- | --- | --- |
| UI Primitives | `src/lib/components/ui/` | shadcn-svelte components (Button, Dialog, Input, etc.) |
| Domain Components | `src/lib/components/` | Kanban-specific building blocks (CardItem, ColumnHeader, LabelBadge) |
| Containers | `src/lib/components/containers/` | Data-binding wrappers that connect components to stores and load data |
| Page Components | `src/routes/**/+page.svelte` | Top-level route views composed from containers and domain components |

## UI Primitives

shadcn-svelte components live in `src/lib/components/ui/`. These are generated via the shadcn-svelte CLI and customized in place.

| Component | Usage |
| --- | --- |
| `button` | Primary actions, toolbar buttons |
| `dialog` | Card detail modals, confirmations |
| `alert-dialog` | Destructive action confirmations |
| `input` | Text fields, search bars |
| `label` | Form field labels |
| `select` | Dropdowns (assignee picker, label picker) |
| `sheet` | Slide-over panels |
| `table` | Tabular data views |
| `form` | Form wrapper with validation |
| `separator` | Visual dividers |
| `tooltip` | Hover hints |
| `skeleton` | Loading placeholders |
| `sonner` | Toast notifications |
| `sidebar` | Navigation sidebar |
| `command` | Command palette / search |
| `collapsible` | Expandable sections |
| `breadcrumb` | Navigation breadcrumbs |
| `switch` | Toggle switches |
| `progress` | Progress indicators |

Import from `$lib/components/ui/<component>`:

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Select from "$lib/components/ui/select";
</script>
```

### No Tabs Component

shadcn-svelte does not include a Tabs component. Use a custom segmented control:

```svelte
<div class="flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
  {#each tabs as tab}
    <button
      class={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        activeTab === tab.id
          ? "bg-white shadow-sm dark:bg-neutral-700"
          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
      )}
      onclick={() => activeTab = tab.id}
    >
      {tab.label}
    </button>
  {/each}
</div>
```

## Domain Components

Kanban-specific components live in `src/lib/components/`. Organized by feature area.

| Area | Location | Components |
| --- | --- | --- |
| Board | `src/lib/components/board/` | `BoardHeader`, `BoardToolbar`, `BoardView` |
| Columns | `src/lib/components/column/` | `Column`, `ColumnHeader`, `ColumnFooter`, `AddColumn` |
| Cards | `src/lib/components/card/` | `CardItem`, `CardDetail`, `CardHeader`, `AddCard` |
| Labels | `src/lib/components/label/` | `LabelBadge`, `LabelPicker`, `LabelManager` |
| Comments | `src/lib/components/comment/` | `CommentList`, `CommentItem`, `CommentForm` |
| Users | `src/lib/components/user/` | `UserAvatar`, `AssigneePicker`, `UserMenu` |
| Search | `src/lib/components/search/` | `SearchBar`, `FilterPanel`, `FilterChip` |
| Layout | `src/lib/components/layout/` | `AppSidebar`, `Navbar` |

### Component Conventions

All domain components follow these patterns:

```svelte
<script lang="ts">
  import type { Card } from "$lib/types";

  // Props via $props() — no export let
  let { card, onDelete }: { card: Card; onDelete?: (id: string) => void } = $props();

  // Local state via $state
  let editing = $state(false);

  // Derived values via $derived
  let isOverdue = $derived(card.dueDate ? new Date(card.dueDate) < new Date() : false);
</script>
```

Key rules:
- Props use `$props()`, never `export let`
- Local state uses `$state()`
- Computed values use `$derived()`
- Side effects use `$effect()`
- Event callbacks are passed as props (e.g., `onDelete`), not dispatched

## Containers

Containers in `src/lib/components/containers/` connect domain components to server data and stores. They handle data loading, error states, and pass data down as props.

```svelte
<!-- src/lib/components/containers/BoardContainer.svelte -->
<script lang="ts">
  import BoardView from "$lib/components/board/BoardView.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import type { Board } from "$lib/types";

  let { board }: { board: Board } = $props();
</script>

{#if board}
  <BoardView {board} />
{:else}
  <Skeleton class="h-full w-full" />
{/if}
```

In SvelteKit, most data loading happens in `+page.server.ts` / `+layout.server.ts` load functions and is passed to components via page data. Containers primarily exist to:
- Compose multiple domain components together
- Handle loading and error states
- Manage local UI state that spans multiple child components

## Overlays And Dialogs

Dialogs use shadcn-svelte's `Dialog` component backed by bits-ui. See `specs/frontend-dialogs.md` for full patterns.

| Dialog | Purpose |
| --- | --- |
| `CardDetailDialog` | View/edit card details |
| `CreateBoardDialog` | New board creation form |
| `DeleteConfirmDialog` | Destructive action confirmation |
| `LabelManagerDialog` | CRUD for board labels |
| `FilterDialog` | Advanced search and filter |
| `SettingsDialog` | App and board settings |
| `CommandPaletteDialog` | Quick actions via `Cmd+K` |

```svelte
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";

  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger asChild let:builder>
    <Button builders={[builder]}>Open</Button>
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Card Details</Dialog.Title>
    </Dialog.Header>
    <!-- content -->
  </Dialog.Content>
</Dialog.Root>
```

## Icons

All icons come from Lucide Svelte (`@lucide/svelte`). No other icon libraries. Use tree-shakeable individual imports, not the barrel export:

```svelte
<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
</script>

<PlusIcon class="h-4 w-4" />
<Trash2Icon class="h-4 w-4 text-destructive" />
```

## Keyboard Shortcuts

Global keyboard shortcuts are handled at the layout level using `svelte:window` event listeners.

```svelte
<svelte:window onkeydown={handleKeydown} />
```

Key bindings:
- `Cmd+K` — Command palette
- `Cmd+N` — New card
- `Escape` — Close active dialog/panel

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/components/ui/` | shadcn-svelte primitives |
| `src/lib/components/board/` | Board-level components |
| `src/lib/components/card/` | Card components |
| `src/lib/components/column/` | Column components |
| `src/lib/components/label/` | Label components |
| `src/lib/components/comment/` | Comment components |
| `src/lib/components/user/` | User and assignment components |
| `src/lib/components/search/` | Search and filter components |
| `src/lib/components/layout/` | App shell and navigation |
| `src/lib/components/containers/` | Data-binding container components |
| `src/lib/types/` | Shared TypeScript types |
