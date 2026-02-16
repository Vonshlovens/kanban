<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import { cn } from "$lib/utils";

  let {
    column,
    cardCount,
  }: {
    column: {
      id: string;
      name: string;
      wipLimit?: number | null;
    };
    cardCount: number;
  } = $props();

  let editing = $state(false);
  let editName = $state(column.name);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      const form = (e.target as HTMLElement).closest("form");
      form?.requestSubmit();
    }
    if (e.key === "Escape") {
      editing = false;
      editName = column.name;
    }
  }
</script>

<div class="flex items-center gap-1.5 px-3 pt-3 pb-2">
  <GripVerticalIcon
    class="size-3.5 shrink-0 cursor-grab text-muted-foreground/50 opacity-0 transition-opacity group-hover/column:opacity-100"
  />

  {#if editing}
    <form method="POST" action="?/renameColumn" class="flex-1">
      <input type="hidden" name="columnId" value={column.id} />
      <Input
        name="name"
        bind:value={editName}
        class="h-6 border-none bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onblur={() => {
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
</div>
