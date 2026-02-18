<script lang="ts">
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import { Trigger as SidebarTrigger } from "$lib/components/ui/sidebar/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import SettingsIcon from "@lucide/svelte/icons/settings";

  let {
    boardName,
    boardId,
  }: {
    boardName?: string;
    boardId?: string;
  } = $props();
</script>

<header
  class="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
>
  <div class="flex items-center gap-2">
    <SidebarTrigger class="-ml-1" />
    <Separator orientation="vertical" class="mr-2 !h-4" />
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/">Boards</Breadcrumb.Link>
        </Breadcrumb.Item>
        {#if boardName}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{boardName}</Breadcrumb.Page>
          </Breadcrumb.Item>
        {/if}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  </div>
  {#if boardId}
    <Button variant="ghost" size="icon-sm" href="/boards/{boardId}/settings">
      <SettingsIcon class="size-4 text-muted-foreground" />
    </Button>
  {/if}
</header>
