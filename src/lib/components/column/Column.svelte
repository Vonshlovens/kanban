<script lang="ts">
  import ColumnHeader from "./ColumnHeader.svelte";
  import CardItem from "$lib/components/card/CardItem.svelte";
  import AddCard from "$lib/components/card/AddCard.svelte";
  import { cn } from "$lib/utils";
  import type { SuperValidated, Infer } from "sveltekit-superforms";
  import type { createCardSchema } from "$lib/schemas/card";

  let {
    column,
    boardId,
    createCardForm,
  }: {
    column: {
      id: string;
      boardId: string;
      name: string;
      position: number;
      wipLimit?: number | null;
      cards: {
        id: string;
        columnId: string;
        title: string;
        description?: string | null;
        dueDate?: string | Date | null;
        position: number;
        cardLabels?: { label: { id: string; name: string; color: string } }[];
        comments?: unknown[];
      }[];
    };
    boardId: string;
    createCardForm: SuperValidated<Infer<typeof createCardSchema>>;
  } = $props();

  let isOverWipLimit = $derived(
    column.wipLimit != null && column.cards.length > column.wipLimit
  );
</script>

<div
  class={cn(
    "group/column flex h-full w-80 shrink-0 flex-col rounded-xl",
    "bg-muted/50 dark:bg-muted/30",
    "transition-shadow duration-200",
    isOverWipLimit && "ring-2 ring-amber-400/60 dark:ring-amber-500/40"
  )}
>
  <ColumnHeader {column} cardCount={column.cards.length} />

  <div class="flex-1 space-y-1.5 overflow-y-auto px-1.5 py-1">
    {#each column.cards as card (card.id)}
      <CardItem {card} {boardId} />
    {:else}
      <div class="flex items-center justify-center py-8">
        <p class="text-xs text-muted-foreground/60">No cards yet</p>
      </div>
    {/each}
  </div>

  {#if isOverWipLimit}
    <p
      class="px-3 pb-1 text-center text-[10px] font-medium text-amber-600 dark:text-amber-400"
    >
      Over WIP limit
    </p>
  {/if}

  <AddCard columnId={column.id} form={createCardForm} />
</div>
