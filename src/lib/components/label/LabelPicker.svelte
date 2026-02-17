<script lang="ts">
  import TagIcon from "@lucide/svelte/icons/tag";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { enhance } from "$app/forms";
  import type { LabelRef } from "$lib/types";

  let {
    cardId,
    boardLabels,
    assignedLabelIds,
  }: {
    cardId: string;
    boardLabels: LabelRef[];
    assignedLabelIds: string[];
  } = $props();

  let open = $state(false);

  function isAssigned(labelId: string) {
    return assignedLabelIds.includes(labelId);
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button variant="outline" size="sm" {...props} class="w-full justify-start gap-2">
        <TagIcon class="size-3.5" />
        {#if assignedLabelIds.length > 0}
          {assignedLabelIds.length} label{assignedLabelIds.length === 1 ? "" : "s"}
        {:else}
          Add labels
        {/if}
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content class="w-56 p-1.5" align="start">
    <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">Labels</p>
    {#if boardLabels.length === 0}
      <p class="px-2 py-3 text-center text-xs text-muted-foreground">
        No labels yet. Create labels in board settings.
      </p>
    {:else}
      <div class="space-y-0.5">
        {#each boardLabels as label (label.id)}
          {@const assigned = isAssigned(label.id)}
          <form method="POST" action="?/toggleLabel" use:enhance={() => {
            return async ({ update }) => {
              await update();
            };
          }}>
            <input type="hidden" name="cardId" value={cardId} />
            <input type="hidden" name="labelId" value={label.id} />
            <button
              type="submit"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <span
                class="size-3.5 shrink-0 rounded"
                style="background-color: {label.color}"
              ></span>
              <span class="flex-1 truncate text-left">{label.name}</span>
              {#if assigned}
                <CheckIcon class="size-3.5 shrink-0 text-primary" />
              {/if}
            </button>
          </form>
        {/each}
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>
