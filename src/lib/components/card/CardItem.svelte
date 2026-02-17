<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import AlignLeftIcon from "@lucide/svelte/icons/align-left";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import DeleteCardDialog from "./DeleteCardDialog.svelte";
  import MoveCardDialog from "./MoveCardDialog.svelte";
  import LabelBadge from "$lib/components/label/LabelBadge.svelte";
  import { cn } from "$lib/utils";
  import type { BoardCard, ColumnRef } from "$lib/types";

  let {
    card,
    boardId,
    columns = [],
    currentColumnId = "",
  }: {
    card: BoardCard;
    boardId: string;
    columns?: ColumnRef[];
    currentColumnId?: string;
  } = $props();

  let labelCount = $derived(card.cardLabels?.length ?? 0);
  let commentCount = $derived(card.comments?.length ?? 0);
  let hasDescription = $derived(!!card.description);
  let hasMeta = $derived(hasDescription || commentCount > 0 || !!card.dueDate);
  let hasOtherColumns = $derived(columns.filter((c) => c.id !== currentColumnId).length > 0);

  let showDelete = $state(false);
  let showMove = $state(false);
  let menuOpen = $state(false);
</script>

<div class="group/card relative">
  <a
    href="/boards/{boardId}/cards/{card.id}"
    class={cn(
      "block rounded-lg border border-border/60 bg-card p-3 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]",
      "transition-all duration-150",
      "hover:border-border hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.06)] hover:-translate-y-px",
      "dark:border-border/40 dark:shadow-none dark:hover:border-border/70 dark:hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.2)]",
      "active:translate-y-0 active:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"
    )}
  >
    {#if labelCount > 0}
      <div class="mb-2 flex flex-wrap gap-1.5">
        {#each card.cardLabels! as cl (cl.label.id)}
          <LabelBadge name={cl.label.name} color={cl.label.color} size="sm" />
        {/each}
      </div>
    {/if}

    <p class="pr-6 text-sm font-medium leading-snug text-foreground">{card.title}</p>

    {#if hasMeta}
      <div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {#if card.dueDate}
          <span class="flex items-center gap-1">
            <CalendarIcon class="size-3" />
            {new Date(card.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        {/if}
        {#if hasDescription}
          <AlignLeftIcon class="size-3" />
        {/if}
        {#if commentCount > 0}
          <span class="flex items-center gap-1">
            <MessageSquareIcon class="size-3" />
            {commentCount}
          </span>
        {/if}
      </div>
    {/if}
  </a>

  <!-- Actions menu — floats over the card, visible on hover or when open -->
  <div
    class={cn(
      "absolute right-1.5 top-1.5 transition-opacity duration-100",
      menuOpen ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
    )}
  >
    <DropdownMenu.Root bind:open={menuOpen}>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            class="flex size-6 items-center justify-center rounded-md bg-card text-muted-foreground shadow-sm ring-1 ring-border/60 transition-colors hover:bg-accent hover:text-foreground dark:ring-border/40"
            onclick={(e) => e.stopPropagation()}
            onpointerdown={(e) => e.stopPropagation()}
          >
            <EllipsisIcon class="size-3.5" />
            <span class="sr-only">Card actions</span>
          </button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-40">
        {#if hasOtherColumns}
          <DropdownMenu.Item onclick={() => (showMove = true)}>
            <ArrowRightIcon class="mr-2 size-3.5" />
            Move to
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
        {/if}
        <DropdownMenu.Item
          class="text-destructive focus:text-destructive"
          onclick={() => (showDelete = true)}
        >
          <Trash2Icon class="mr-2 size-3.5" />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</div>

<DeleteCardDialog bind:open={showDelete} {card} {boardId} />
<MoveCardDialog bind:open={showMove} {card} {boardId} {columns} {currentColumnId} />
