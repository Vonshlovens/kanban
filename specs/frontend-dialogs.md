# Frontend Dialogs

## Overview

All dialogs use shadcn-svelte overlay components backed by bits-ui headless primitives and styled with Tailwind CSS 4. There is no external dialog orchestration library — dialog state is managed with Svelte 5 runes (`$state`, `bind:open`). Three overlay types cover all use cases: Dialog, AlertDialog, and Sheet.

## Overlay Types

| Type | Component | Use Case |
| --- | --- | --- |
| Dialog | `$lib/components/ui/dialog` | Forms, detail views, settings — dismissible via backdrop click or Escape |
| AlertDialog | `$lib/components/ui/alert-dialog` | Destructive confirmations — blocks backdrop dismiss, requires explicit action |
| Sheet | `$lib/components/ui/sheet` | Slide-over panels for secondary content, filters, bulk editing |

Import via shadcn-svelte wrappers, not directly from bits-ui:

```svelte
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import * as Sheet from "$lib/components/ui/sheet";
</script>
```

## Dialog Inventory

Dialogs organized by feature area. Each dialog is a standalone Svelte 5 component.

| Area | Dialogs |
| --- | --- |
| Cards | `CardDetailDialog`, `AddCardDialog` |
| Board | `CreateBoardDialog`, `BoardSettingsDialog` |
| Labels | `LabelManagerDialog` |
| Filters | `FilterDialog` |
| Confirmations | `DeleteConfirmDialog` |
| App | `SettingsDialog`, `CommandPaletteDialog` |

### File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/components/ui/dialog/` | shadcn-svelte Dialog primitive |
| `src/lib/components/ui/alert-dialog/` | shadcn-svelte AlertDialog primitive |
| `src/lib/components/ui/sheet/` | shadcn-svelte Sheet primitive |
| `src/lib/components/dialogs/` | App-specific dialog components |

## Dialog Pattern

Dialogs use local `$state` for open/close and `bind:open` for two-way binding. Callers control visibility via props or by binding the open state.

### Standard Dialog

```svelte
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";

  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline">Edit Card</Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Edit Card</Dialog.Title>
      <Dialog.Description>Update the card details below.</Dialog.Description>
    </Dialog.Header>
    <!-- form content -->
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button type="submit">Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

### Destructive Confirmation (AlertDialog)

AlertDialog prevents accidental dismissal — the user must click Cancel or confirm the action.

```svelte
<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";

  let open = $state(false);

  async function handleDelete() {
    // perform delete
    open = false;
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="destructive" size="sm">Delete</Button>
    {/snippet}
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete this card?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone. The card and all its comments will be permanently removed.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={handleDelete}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```

### Sheet (Slide-Over Panel)

Sheets slide in from the side for secondary content that doesn't warrant a full modal.

```svelte
<script lang="ts">
  import * as Sheet from "$lib/components/ui/sheet";
  import { Button } from "$lib/components/ui/button";

  let open = $state(false);
</script>

<Sheet.Root bind:open>
  <Sheet.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline">Filters</Button>
    {/snippet}
  </Sheet.Trigger>
  <Sheet.Content side="right">
    <Sheet.Header>
      <Sheet.Title>Filters</Sheet.Title>
      <Sheet.Description>Narrow down your board view.</Sheet.Description>
    </Sheet.Header>
    <!-- filter controls -->
  </Sheet.Content>
</Sheet.Root>
```

## State Management

### Local State (Default)

Most dialogs own their open state via a local `$state` boolean. The dialog component itself manages when to open and close.

```svelte
<script lang="ts">
  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <!-- ... -->
</Dialog.Root>
```

### Controlled by Parent

When a parent needs to open a dialog programmatically (e.g., from a context menu or keyboard shortcut), pass `open` as a bindable prop:

```svelte
<!-- CardActions.svelte -->
<script lang="ts">
  import DeleteConfirmDialog from "$lib/components/dialogs/DeleteConfirmDialog.svelte";

  let showDelete = $state(false);

  function handleContextAction(action: string) {
    if (action === "delete") showDelete = true;
  }
</script>

<DeleteConfirmDialog bind:open={showDelete} onConfirm={handleDelete} />
```

```svelte
<!-- DeleteConfirmDialog.svelte -->
<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  let { open = $bindable(false), onConfirm }: {
    open: boolean;
    onConfirm: () => void;
  } = $props();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Are you sure?</AlertDialog.Title>
      <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={onConfirm}>Confirm</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```

### Keyboard Shortcuts

Global shortcuts that open dialogs are handled at the layout level:

```svelte
<svelte:window onkeydown={handleKeydown} />
```

- `Cmd+K` — Open command palette (`CommandPaletteDialog`)
- `Cmd+N` — Open new card dialog (`AddCardDialog`)
- `Escape` — Close the topmost open dialog (handled automatically by bits-ui)

## Conventions

- **One dialog per file.** Each dialog is a standalone `.svelte` component in `src/lib/components/dialogs/`.
- **Props via `$props()`.** Never use `export let`.
- **Open state via `$state` + `bind:open`.** No external dialog manager or store.
- **Use `$bindable`** when a parent needs to control open/close from outside.
- **Callbacks as props.** Pass `onConfirm`, `onSave`, `onDelete`, etc. — don't use custom events.
- **Use AlertDialog for destructive actions.** Always require explicit confirmation for deletes and irreversible operations.
- **Use Sheet for secondary panels.** Filters, bulk edit, and detail sidebars.
- **Escape closes dialogs.** This is automatic with bits-ui — do not override.
- **Focus trapping is automatic.** bits-ui handles focus management within open dialogs.
