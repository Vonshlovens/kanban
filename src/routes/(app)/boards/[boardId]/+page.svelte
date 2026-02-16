<script lang="ts">
  import Column from "$lib/components/column/Column.svelte";
  import AddColumn from "$lib/components/column/AddColumn.svelte";

  let { data } = $props();
</script>

<div class="flex h-full flex-col">
  <div class="flex-1 overflow-x-auto overflow-y-hidden">
    <div class="flex h-full items-start gap-4 p-4">
      {#each data.board.columns as column (column.id)}
        <Column {column} boardId={data.board.id} createCardForm={data.createCardForm} />
      {:else}
        <div class="flex w-full items-center justify-center py-20">
          <div class="text-center">
            <p class="text-sm text-muted-foreground">
              No columns yet. Add one to get started.
            </p>
          </div>
        </div>
      {/each}

      <AddColumn form={data.createColumnForm} />
    </div>
  </div>
</div>
