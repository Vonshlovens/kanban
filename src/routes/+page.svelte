<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import StarIcon from "@lucide/svelte/icons/star";
  import KanbanIcon from "@lucide/svelte/icons/kanban";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";

  let { data } = $props();

  function timeAgo(date: Date | string): string {
    const now = Date.now();
    const then = new Date(date).getTime();
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }
</script>

<div class="min-h-screen bg-background">
  <div class="mx-auto max-w-5xl px-6 py-16 sm:py-24">
    <header class="mb-12">
      <div class="flex items-end justify-between gap-4">
        <div>
          <div class="mb-2 flex items-center gap-2 text-muted-foreground">
            <LayoutDashboardIcon class="size-4" />
            <span class="text-xs font-medium uppercase tracking-widest">Workspace</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Your Boards
          </h1>
        </div>
        <Button href="/boards/new" size="default">
          <PlusIcon class="size-4" />
          New Board
        </Button>
      </div>
      <div class="mt-4 h-px bg-border" />
    </header>

    {#if data.boards.length === 0}
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="mb-6 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <KanbanIcon class="size-7 text-muted-foreground" />
        </div>
        <h2 class="mb-2 text-lg font-semibold">No boards yet</h2>
        <p class="mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Create your first board to start organizing tasks into columns and cards.
        </p>
        <Button href="/boards/new" size="lg">
          <PlusIcon class="size-4" />
          Create Your First Board
        </Button>
      </div>
    {:else}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.boards as board (board.id)}
          <a
            href="/boards/{board.id}"
            class="group focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-[3px]"
          >
            <Card.Root
              class="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-accent/50"
            >
              <Card.Header>
                <div class="flex items-start justify-between gap-2">
                  <Card.Title class="line-clamp-1 text-base">{board.name}</Card.Title>
                  {#if board.isFavorite}
                    <StarIcon
                      class="size-3.5 shrink-0 fill-amber-400 text-amber-400 dark:fill-amber-300 dark:text-amber-300"
                    />
                  {/if}
                </div>
                <Card.Description class="line-clamp-2">
                  {board.description || "No description"}
                </Card.Description>
              </Card.Header>
              <Card.Footer class="text-xs text-muted-foreground">
                <ClockIcon class="size-3 opacity-60" />
                <span class="ml-1">{timeAgo(board.updatedAt)}</span>
              </Card.Footer>
            </Card.Root>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
