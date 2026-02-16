<script lang="ts">
  import { dndzone, SOURCES, TRIGGERS } from "svelte-dnd-action";
  import type { DndEvent } from "svelte-dnd-action";
  import ColumnHeader from "./ColumnHeader.svelte";
  import CardItem from "$lib/components/card/CardItem.svelte";
  import AddCard from "$lib/components/card/AddCard.svelte";
  import { cn } from "$lib/utils";
  import type { SuperValidated, Infer } from "sveltekit-superforms";
  import type { createCardSchema } from "$lib/schemas/card";

  let {
    column,
    boardId,
    otherColumns,
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
    otherColumns: { id: string; name: string }[];
    createCardForm: SuperValidated<Infer<typeof createCardSchema>>;
  } = $props();

  const FLIP_MS = 200;

  let cardItems = $state(column.cards);

  // Track original card IDs for cross-column move detection
  let originalCardIds = $state(new Set(column.cards.map((c) => c.id)));

  // Sync when server data changes (e.g. after card create/delete)
  $effect(() => {
    cardItems = column.cards;
    originalCardIds = new Set(column.cards.map((c) => c.id));
  });

  let isOverWipLimit = $derived(
    column.wipLimit != null && cardItems.length > column.wipLimit,
  );

  function handleCardConsider(e: CustomEvent<DndEvent>) {
    cardItems = e.detail.items as typeof cardItems;
  }

  async function handleCardFinalize(e: CustomEvent<DndEvent>) {
    cardItems = e.detail.items as typeof cardItems;
    const { trigger } = e.detail.info;

    // Persist the new order within this column
    await fetch(`/boards/${boardId}/cards/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardIds: cardItems.map((c) => c.id),
      }),
    });

    // If a card was dropped here from another column, update its columnId
    if (
      trigger === TRIGGERS.DROPPED_INTO_ZONE ||
      trigger === TRIGGERS.DROPPED_INTO_ANOTHER
    ) {
      const droppedCard = cardItems.find((c) => !originalCardIds.has(c.id));
      if (droppedCard) {
        const position = cardItems.indexOf(droppedCard);
        const fd = new FormData();
        fd.append("cardId", droppedCard.id);
        fd.append("targetColumnId", column.id);
        fd.append("position", String(position));

        await fetch(`/boards/${boardId}?/moveCard`, {
          method: "POST",
          body: fd,
        });
      }
    }
  }
</script>

<div
  class={cn(
    "group/column flex h-full w-80 shrink-0 flex-col rounded-xl",
    "bg-muted/50 dark:bg-muted/30",
    "transition-shadow duration-200",
    isOverWipLimit && "ring-2 ring-amber-400/60 dark:ring-amber-500/40",
  )}
>
  <ColumnHeader
    {column}
    cardCount={cardItems.length}
    {otherColumns}
    {boardId}
  />

  <div
    class="card-dropzone flex-1 space-y-1.5 overflow-y-auto px-1.5 py-1"
    use:dndzone={{
      items: cardItems,
      flipDurationMs: FLIP_MS,
      type: "cards",
    }}
    onconsider={handleCardConsider}
    onfinalize={handleCardFinalize}
  >
    {#each cardItems as card (card.id)}
      <CardItem {card} {boardId} />
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
