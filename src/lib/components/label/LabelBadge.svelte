<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    name,
    color,
    size = "sm",
    class: className,
  }: {
    name: string;
    color: string;
    size?: "sm" | "md";
    class?: string;
  } = $props();
</script>

{#if size === "sm"}
  <span
    class={cn("inline-block h-1.5 w-6 rounded-full", className)}
    style="background-color: {color}"
    title={name}
  ></span>
{:else}
  <span
    class={cn("inline-block rounded px-2 py-0.5 text-xs font-medium text-white", className)}
    style="background-color: {color}"
  >
    {name}
  </span>
{/if}
