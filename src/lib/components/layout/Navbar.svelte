<script lang="ts">
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import { Trigger as SidebarTrigger } from "$lib/components/ui/sidebar/index.js";

  let {
    boardName,
  }: {
    boardName?: string;
  } = $props();
</script>

<header
  class="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
>
  <div class="flex items-center gap-2">
    <SidebarTrigger class="-ml-1" />
    <Separator orientation="vertical" class="mr-2 !h-4" />
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/boards">Boards</Breadcrumb.Link>
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
</header>
