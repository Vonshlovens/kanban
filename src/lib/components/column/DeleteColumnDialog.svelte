<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button/index.js";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import type { ColumnRef } from "$lib/types";

  let {
    column,
    cardCount,
    otherColumns,
    boardId,
    open = $bindable(false),
  }: {
    column: ColumnRef;
    cardCount: number;
    otherColumns: ColumnRef[];
    boardId: string;
    open: boolean;
  } = $props();

  let moveCardsTo = $state<string | undefined>(undefined);
  let deleteFormEl: HTMLFormElement | undefined = $state();
  let deleting = $state(false);

  let hasCards = $derived(cardCount > 0);
  let canMigrate = $derived(hasCards && otherColumns.length > 0);
  let selectedColumnName = $derived(
    otherColumns.find((c) => c.id === moveCardsTo)?.name
  );
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete "{column.name}"?</AlertDialog.Title>
      <AlertDialog.Description>
        {#if hasCards}
          This column contains <strong class="font-medium text-foreground">{cardCount} card{cardCount === 1 ? "" : "s"}</strong>. Choose what to do with them before deleting.
        {:else}
          This empty column will be permanently removed. This cannot be undone.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>

    {#if canMigrate}
      <div class="space-y-3 py-2">
        <Select.Root type="single" onValueChange={(v) => (moveCardsTo = v)}>
          <Select.Trigger class="w-full">
            {#if selectedColumnName}
              {selectedColumnName}
            {:else}
              <span class="text-muted-foreground">Move cards to...</span>
            {/if}
          </Select.Trigger>
          <Select.Content>
            {#each otherColumns as col (col.id)}
              <Select.Item value={col.id}>{col.name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <p class="text-xs text-muted-foreground">
          Leave empty to permanently delete all cards in this column.
        </p>
      </div>
    {:else if hasCards}
      <div class="rounded-md bg-destructive/5 p-3 dark:bg-destructive/10">
        <p class="text-xs text-destructive">
          This is the only column. All {cardCount} card{cardCount === 1 ? "" : "s"} will be permanently deleted.
        </p>
      </div>
    {/if}

    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => { moveCardsTo = undefined; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        class="bg-destructive text-white hover:bg-destructive/90"
        onclick={() => { deleting = true; deleteFormEl?.requestSubmit(); }}
        disabled={deleting}
      >
        {#if deleting}
          <LoaderCircleIcon class="size-3.5 animate-spin" />
        {/if}
        Delete column
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<form
  bind:this={deleteFormEl}
  method="POST"
  action="/boards/{boardId}?/deleteColumn"
  class="hidden"
  use:enhance={() => {
    return async ({ update, result }) => {
      await update();
      if (result.type === "success") {
        toast.success(`Column "${column.name}" deleted`);
      } else if (result.type === "error") {
        deleting = false;
        toast.error("Failed to delete column");
      }
    };
  }}
>
  <input type="hidden" name="columnId" value={column.id} />
  {#if moveCardsTo}
    <input type="hidden" name="moveCardsTo" value={moveCardsTo} />
  {/if}
</form>
