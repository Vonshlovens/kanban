<script lang="ts">
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import AlignLeftIcon from "@lucide/svelte/icons/align-left";
  import { cn } from "$lib/utils";

  let {
    card,
    boardId,
  }: {
    card: {
      id: string;
      title: string;
      description?: string | null;
      dueDate?: string | Date | null;
      position: number;
      cardLabels?: { label: { id: string; name: string; color: string } }[];
      comments?: unknown[];
    };
    boardId: string;
  } = $props();

  let labelCount = $derived(card.cardLabels?.length ?? 0);
  let commentCount = $derived(card.comments?.length ?? 0);
  let hasDescription = $derived(!!card.description);
  let hasMeta = $derived(hasDescription || commentCount > 0 || !!card.dueDate);
</script>

<a
  href="/boards/{boardId}/cards/{card.id}"
  class={cn(
    "group block rounded-lg border border-border/60 bg-card p-3 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]",
    "transition-all duration-150",
    "hover:border-border hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.06)] hover:-translate-y-px",
    "dark:border-border/40 dark:shadow-none dark:hover:border-border/70 dark:hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.2)]",
    "active:translate-y-0 active:shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"
  )}
>
  {#if labelCount > 0}
    <div class="mb-2 flex flex-wrap gap-1.5">
      {#each card.cardLabels! as cl (cl.label.id)}
        <span
          class="inline-block h-1.5 w-6 rounded-full"
          style="background-color: {cl.label.color}"
          title={cl.label.name}
        ></span>
      {/each}
    </div>
  {/if}

  <p class="text-sm font-medium leading-snug text-foreground">{card.title}</p>

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
