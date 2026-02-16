<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { toggleMode, mode } from "mode-watcher";
  import KanbanIcon from "@lucide/svelte/icons/kanban";
  import StarIcon from "@lucide/svelte/icons/star";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import MonitorIcon from "@lucide/svelte/icons/monitor";

  let {
    boards = [],
    activeBoardId,
  }: {
    boards?: { id: string; name: string; isFavorite: boolean }[];
    activeBoardId?: string;
  } = $props();

  let favoriteBoards = $derived(boards.filter((b) => b.isFavorite));
  let otherBoards = $derived(boards.filter((b) => !b.isFavorite));

  let themeIcon = $derived(
    mode.current === "dark"
      ? MoonIcon
      : mode.current === "light"
        ? SunIcon
        : MonitorIcon
  );
  let themeLabel = $derived(
    mode.current === "dark"
      ? "Dark"
      : mode.current === "light"
        ? "Light"
        : "System"
  );
</script>

<Sidebar.Root collapsible="icon">
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="lg" class="pointer-events-none">
          <div
            class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
          >
            <KanbanIcon class="size-4" />
          </div>
          <div class="grid flex-1 text-left leading-tight">
            <span class="truncate font-semibold tracking-tight">Kanban</span>
            <span class="truncate text-xs text-sidebar-foreground/60"
              >Task Management</span
            >
          </div>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Content>
    {#if favoriteBoards.length > 0}
      <Sidebar.Group>
        <Sidebar.GroupLabel>
          <StarIcon class="mr-1.5 size-3 fill-current opacity-50" />
          Favorites
        </Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each favoriteBoards as board (board.id)}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  isActive={board.id === activeBoardId}
                  tooltipContent={board.name}
                >
                  {#snippet child({ props })}
                    <a href="/boards/{board.id}" {...props}>
                      <KanbanIcon class="opacity-60" />
                      <span>{board.name}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>

      <Separator class="mx-auto w-[calc(100%-2rem)]" />
    {/if}

    <Sidebar.Group class="flex-1">
      <Sidebar.GroupLabel>Boards</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          {#each otherBoards as board (board.id)}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                isActive={board.id === activeBoardId}
                tooltipContent={board.name}
              >
                {#snippet child({ props })}
                  <a href="/boards/{board.id}" {...props}>
                    <KanbanIcon class="opacity-60" />
                    <span>{board.name}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}

          <Sidebar.MenuItem>
            <Sidebar.MenuButton tooltipContent="New Board" class="text-sidebar-foreground/50 hover:text-sidebar-accent-foreground">
              {#snippet child({ props })}
                <a href="/boards/new" {...props}>
                  <PlusIcon class="opacity-60" />
                  <span>New Board</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton onclick={toggleMode} tooltipContent="Toggle theme">
          {#snippet child({ props })}
            <button {...props}>
              <themeIcon class="opacity-60" />
              <span>{themeLabel}</span>
            </button>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>

  <Sidebar.Rail />
</Sidebar.Root>
