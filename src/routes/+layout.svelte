<script lang="ts">
  import type { Snippet } from "svelte";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";
  import "../app.css";

  let { children }: { children: Snippet } = $props();
</script>

<ModeWatcher />
<Toaster />
{@render children()}
