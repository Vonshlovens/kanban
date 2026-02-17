<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import DeleteColumnDialog from "./DeleteColumnDialog.svelte";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import GaugeIcon from "@lucide/svelte/icons/gauge";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { untrack } from "svelte";
  import { dragHandle } from "svelte-dnd-action";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import { cn } from "$lib/utils";

  let {
    column,
    cardCount,
    otherColumns,
    boardId,
  }: {
    column: {
      id: string;
      name: string;
      wipLimit?: number | null;
    };
    cardCount: number;
    otherColumns: { id: string; name: string }[];
    boardId: string;
  } = $props();

  let editing = $state(false);
  let editName = $state(untrack(() => column.name));
  let renameSubmitting = $state(false);
  let menuOpen = $state(false);
  let showDelete = $state(false);
  let settingWip = $state(false);
  let wipValue = $state(0);
  let wipFormEl: HTMLFormElement | undefined = $state();
  let wipSaving = $state(false);

  $effect(() => {
    // Sync edit name when column name changes (e.g. after rename)
    editName = column.name;
  });

  $effect(() => {
    // Reset WIP value when panel opens or column prop changes
    wipValue = column.wipLimit ?? 0;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      renameSubmitting = true;
      const form = (e.target as HTMLElement).closest("form");
      form?.requestSubmit();
    }
    if (e.key === "Escape") {
      editing = false;
      editName = column.name;
    }
  }

  function handleWipKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      wipFormEl?.requestSubmit();
      settingWip = false;
    }
    if (e.key === "Escape") {
      settingWip = false;
      wipValue = column.wipLimit ?? 0;
    }
  }
</script>

<div class="flex items-center gap-1.5 px-3 pt-3 pb-2">
  <div
    use:dragHandle
    aria-label="Drag to reorder column"
    class="shrink-0 cursor-grab opacity-0 transition-opacity group-hover/column:opacity-100 active:cursor-grabbing"
  >
    <GripVerticalIcon
      class="size-3.5 text-muted-foreground/50"
    />
  </div>

  {#if editing}
    <form
      method="POST"
      action="?/renameColumn"
      class="flex-1"
      use:enhance={() => {
        return async ({ update, result }) => {
          await update();
          renameSubmitting = false;
          editing = false;
          if (result.type === "success") {
            toast.success("Column renamed");
          } else if (result.type === "error") {
            toast.error("Failed to rename column");
            editName = column.name;
          }
        };
      }}
    >
      <input type="hidden" name="columnId" value={column.id} />
      <Input
        name="name"
        bind:value={editName}
        class="h-6 border-none bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onblur={() => {
          if (renameSubmitting) return;
          editing = false;
          editName = column.name;
        }}
        onkeydown={handleKeydown}
        autofocus
      />
    </form>
  {:else}
    <button
      class="flex-1 truncate text-left text-sm font-semibold text-foreground"
      ondblclick={() => (editing = true)}
      title="Double-click to rename"
    >
      {column.name}
    </button>
  {/if}

  <span
    class={cn(
      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none",
      column.wipLimit != null && cardCount > column.wipLimit
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
        : "bg-muted text-muted-foreground"
    )}
  >
    {cardCount}{#if column.wipLimit != null}<span class="opacity-50">/{column.wipLimit}</span>{/if}
  </span>

  <div class={cn(
    "transition-opacity duration-100",
    menuOpen ? "opacity-100" : "opacity-0 group-hover/column:opacity-100"
  )}>
    <DropdownMenu.Root bind:open={menuOpen}>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="ghost" size="icon-sm" class="size-6 text-muted-foreground" {...props}>
            <EllipsisIcon class="size-3.5" />
            <span class="sr-only">Column actions</span>
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-48">
        <DropdownMenu.Item onclick={() => { editing = true; }}>
          <PencilIcon class="mr-2 size-3.5" />
          Rename
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => { settingWip = true; }}>
          <GaugeIcon class="mr-2 size-3.5" />
          Set WIP limit
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="destructive" onclick={() => { showDelete = true; }}>
          <Trash2Icon class="mr-2 size-3.5" />
          Delete column
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</div>

{#if settingWip}
  <div class="mx-3 mb-2 rounded-lg border border-border/60 bg-card p-2.5 shadow-sm dark:border-border/40">
    <div class="mb-2 flex items-center justify-between">
      <span class="text-xs font-medium text-muted-foreground">WIP Limit</span>
      {#if column.wipLimit != null}
        <button
          class="text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors"
          onclick={() => { wipValue = 0; wipSaving = true; wipFormEl?.requestSubmit(); settingWip = false; }}
        >
          Remove
        </button>
      {/if}
    </div>
    <div class="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-sm"
        class="size-7"
        onclick={() => { if (wipValue > 0) wipValue--; }}
        disabled={wipValue <= 0}
      >
        <MinusIcon class="size-3" />
      </Button>
      <Input
        type="number"
        min="0"
        bind:value={wipValue}
        onkeydown={handleWipKeydown}
        class="h-7 w-14 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        autofocus
      />
      <Button
        variant="outline"
        size="icon-sm"
        class="size-7"
        onclick={() => wipValue++}
      >
        <PlusIcon class="size-3" />
      </Button>
      <Button
        size="sm"
        class="ml-auto h-7 px-2.5 text-xs"
        disabled={wipSaving}
        onclick={() => { wipSaving = true; wipFormEl?.requestSubmit(); settingWip = false; }}
      >
        {#if wipSaving}
          <LoaderCircleIcon class="size-3 animate-spin" />
        {/if}
        Save
      </Button>
    </div>
  </div>
{/if}

<!-- Hidden form for WIP limit updates -->
<form
  bind:this={wipFormEl}
  method="POST"
  action="?/updateWipLimit"
  class="hidden"
  use:enhance={() => {
    return async ({ update, result }) => {
      await update();
      wipSaving = false;
      if (result.type === "success") {
        toast.success(wipValue === 0 ? "WIP limit removed" : "WIP limit updated");
      } else if (result.type === "error") {
        toast.error("Failed to update WIP limit");
      }
    };
  }}
>
  <input type="hidden" name="columnId" value={column.id} />
  <input type="hidden" name="wipLimit" value={wipValue === 0 ? "" : wipValue} />
</form>

<DeleteColumnDialog
  bind:open={showDelete}
  {column}
  {cardCount}
  {otherColumns}
  {boardId}
/>
