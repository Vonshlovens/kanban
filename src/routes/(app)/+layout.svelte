<script lang="ts">
  import type { Snippet } from "svelte";
  import type { SidebarBoard } from "$lib/types";
  import { page } from "$app/stores";
  import { Provider as SidebarProvider } from "$lib/components/ui/sidebar/index.js";
  import AppSidebar from "$lib/components/layout/AppSidebar.svelte";
  import Navbar from "$lib/components/layout/Navbar.svelte";

  let { data, children }: { data: { boards: SidebarBoard[] }; children: Snippet } = $props();

  let activeBoardId = $derived($page.params.boardId);
  let boardName = $derived(
    activeBoardId
      ? data.boards.find((b) => b.id === activeBoardId)?.name
      : undefined
  );
</script>

<SidebarProvider>
  <AppSidebar boards={data.boards} {activeBoardId} />
  <div class="flex flex-1 flex-col overflow-hidden">
    <Navbar {boardName} boardId={activeBoardId} />
    <main class="flex-1 overflow-auto">
      {@render children()}
    </main>
  </div>
</SidebarProvider>
