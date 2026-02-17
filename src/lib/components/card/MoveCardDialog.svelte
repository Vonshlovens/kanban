<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button/index.js";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import type { Card, ColumnRef } from "$lib/types";

  let {
    card,
    boardId,
    columns,
    currentColumnId,
    open = $bindable(false),
  }: {
    card: Pick<Card, "id" | "title">;
    boardId: string;
    columns: ColumnRef[];
    currentColumnId: string;
    open: boolean;
  } = $props();

  let targetColumnId = $state<string | undefined>(undefined);
  let moveFormEl: HTMLFormElement | undefined = $state();

  let targetColumnName = $derived(
    columns.find((c) => c.id === targetColumnId)?.name
  );
  let currentColumnName = $derived(
    columns.find((c) => c.id === currentColumnId)?.name ?? "Unknown"
  );
  let otherColumns = $derived(columns.filter((c) => c.id !== currentColumnId));
  let canMove = $derived(!!targetColumnId);
  let moving = $state(false);

  function handleMove() {
    if (!canMove) return;
    moving = true;
    moveFormEl?.requestSubmit();
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;
    if (!isOpen) {
      targetColumnId = undefined;
    }
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Move card</Dialog.Title>
      <Dialog.Description>
        Move <strong class="font-medium text-foreground">"{card.title}"</strong> to
        another column.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-3 py-2">
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <span class="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
          {currentColumnName}
        </span>
        <ArrowRightIcon class="size-3.5" />
        {#if targetColumnName}
          <span class="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {targetColumnName}
          </span>
        {:else}
          <span class="text-muted-foreground/60">Select column...</span>
        {/if}
      </div>

      <Select.Root type="single" onValueChange={(v) => (targetColumnId = v)}>
        <Select.Trigger class="w-full">
          {#if targetColumnName}
            {targetColumnName}
          {:else}
            <span class="text-muted-foreground">Choose a column...</span>
          {/if}
        </Select.Trigger>
        <Select.Content>
          {#each otherColumns as col (col.id)}
            <Select.Item value={col.id}>{col.name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button disabled={!canMove || moving} onclick={handleMove}>
        {#if moving}
          <LoaderCircleIcon class="size-3.5 animate-spin" />
        {/if}
        Move card
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<form
  bind:this={moveFormEl}
  method="POST"
  action="/boards/{boardId}?/moveCard"
  class="hidden"
  use:enhance={() => {
    return async ({ update, result }) => {
      await update();
      if (result.type === "success") {
        toast.success(`Card moved to "${targetColumnName}"`);
        open = false;
        targetColumnId = undefined;
        moving = false;
      } else if (result.type === "error") {
        moving = false;
        toast.error("Failed to move card");
      }
    };
  }}
>
  <input type="hidden" name="cardId" value={card.id} />
  <input type="hidden" name="targetColumnId" value={targetColumnId ?? ""} />
  <input type="hidden" name="position" value="0" />
</form>
