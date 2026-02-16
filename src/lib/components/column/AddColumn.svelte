<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { superForm } from "sveltekit-superforms";
  import type { SuperValidated, Infer } from "sveltekit-superforms";
  import type { createColumnSchema } from "$lib/schemas/column";

  let {
    form: formData,
  }: {
    form: SuperValidated<Infer<typeof createColumnSchema>>;
  } = $props();

  const { form, enhance } = superForm(formData, {
    resetForm: true,
    onResult: () => {
      adding = false;
    },
  });

  let adding = $state(false);
</script>

{#if adding}
  <div class="w-80 shrink-0 rounded-xl bg-muted/50 p-3 dark:bg-muted/30">
    <form method="POST" action="?/createColumn" use:enhance class="space-y-2">
      <Input
        name="name"
        bind:value={$form.name}
        placeholder="Column name..."
        class="h-8 text-sm"
        autofocus
      />
      <div class="flex items-center gap-1.5">
        <Button type="submit" size="sm" class="h-7 px-3 text-xs">
          Add column
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="size-7"
          onclick={() => (adding = false)}
        >
          <XIcon class="size-3.5" />
        </Button>
      </div>
    </form>
  </div>
{:else}
  <Button
    variant="ghost"
    class="h-10 w-80 shrink-0 justify-start gap-1.5 rounded-xl border border-dashed border-border/50 text-sm text-muted-foreground hover:border-border hover:text-foreground"
    onclick={() => (adding = true)}
  >
    <PlusIcon class="size-4" />
    Add column
  </Button>
{/if}
