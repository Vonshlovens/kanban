<script lang="ts">
  import { cn } from "$lib/utils";
  import { X } from "@lucide/svelte";

  let {
    labels,
    selectedIds,
    onToggle,
    onClear,
  }: {
    labels: Array<{ id: string; name: string; color: string }>;
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onClear: () => void;
  } = $props();

  let hasSelection = $derived(selectedIds.size > 0);
</script>

{#if labels.length > 0}
  <div class="flex flex-wrap items-center gap-1.5 px-4 py-2">
    <span
      class={cn(
        "mr-0.5 select-none text-[11px] font-semibold uppercase tracking-widest",
        hasSelection
          ? "text-foreground/70"
          : "text-muted-foreground/60",
      )}
    >
      Labels
    </span>

    {#each labels as label (label.id)}
      {@const active = selectedIds.has(label.id)}
      <button
        type="button"
        class={cn(
          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium text-white",
          "shadow-sm transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          active
            ? "ring-1.5 ring-white/50 shadow-md scale-[1.02]"
            : "opacity-50 hover:opacity-80 hover:shadow",
        )}
        style="background-color: {label.color}"
        onclick={() => onToggle(label.id)}
        aria-pressed={active}
      >
        {label.name}
      </button>
    {/each}

    {#if hasSelection}
      <button
        type="button"
        class={cn(
          "ml-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5",
          "text-[11px] font-medium text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        onclick={onClear}
      >
        <X class="h-3 w-3" />
        Clear
      </button>
    {/if}
  </div>
{/if}
