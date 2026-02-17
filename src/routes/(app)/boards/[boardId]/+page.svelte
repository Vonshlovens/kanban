<script lang="ts">
  import { dragHandleZone } from "svelte-dnd-action";
  import type { DndEvent } from "svelte-dnd-action";
  import { untrack } from "svelte";
  import Column from "$lib/components/column/Column.svelte";
  import AddColumn from "$lib/components/column/AddColumn.svelte";
  import LabelFilterBar from "$lib/components/label/LabelFilterBar.svelte";
  import type { BoardColumn } from "$lib/types";

  let { data } = $props();

  const FLIP_MS = 200;

  let columnItems = $state(untrack(() => data.board.columns));

  // Sync when server data changes (e.g. after column create/delete/rename)
  $effect(() => {
    columnItems = data.board.columns;
  });

  // --- Label filtering (client-side, OR logic) ---
  let selectedLabelIds = $state<Set<string>>(new Set());

  function toggleLabelFilter(labelId: string) {
    if (selectedLabelIds.has(labelId)) {
      selectedLabelIds.delete(labelId);
    } else {
      selectedLabelIds.add(labelId);
    }
    selectedLabelIds = new Set(selectedLabelIds);
  }

  function clearLabelFilter() {
    selectedLabelIds = new Set();
  }

  let filteredColumns = $derived<BoardColumn[]>(
    selectedLabelIds.size === 0
      ? columnItems
      : columnItems.map((col) => ({
          ...col,
          cards: col.cards.filter((card) =>
            card.cardLabels?.some((cl) => selectedLabelIds.has(cl.label.id)),
          ),
        })),
  );

  function handleColumnConsider(e: CustomEvent<DndEvent>) {
    columnItems = e.detail.items as typeof columnItems;
  }

  async function handleColumnFinalize(e: CustomEvent<DndEvent>) {
    columnItems = e.detail.items as typeof columnItems;

    await fetch(`/boards/${data.board.id}/columns/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columnIds: columnItems.map((c) => c.id),
      }),
    });
  }
</script>

<div class="flex h-full flex-col">
  <LabelFilterBar
    labels={data.board.labels}
    selectedIds={selectedLabelIds}
    onToggle={toggleLabelFilter}
    onClear={clearLabelFilter}
  />

  <div class="flex-1 overflow-x-auto overflow-y-hidden p-4">
    <div class="flex h-full items-start gap-4">
      <div
        class="flex h-full items-start gap-4"
        use:dragHandleZone={{
          items: columnItems,
          flipDurationMs: FLIP_MS,
          type: "columns",
        }}
        onconsider={handleColumnConsider}
        onfinalize={handleColumnFinalize}
      >
        {#each filteredColumns as column (column.id)}
          <Column
            {column}
            boardId={data.board.id}
            otherColumns={columnItems
              .filter((c) => c.id !== column.id)
              .map((c) => ({ id: c.id, name: c.name }))}
            allColumns={columnItems.map((c) => ({ id: c.id, name: c.name }))}
            createCardForm={data.createCardForm}
          />
        {/each}
      </div>

      <AddColumn form={data.createColumnForm} />
    </div>

    {#if columnItems.length === 0}
      <div class="flex w-full items-center justify-center py-20">
        <div class="text-center">
          <p class="text-sm text-muted-foreground">
            No columns yet. Add one to get started.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
