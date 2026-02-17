<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  import { untrack } from "svelte";
  import type { SuperValidated, Infer } from "sveltekit-superforms";
  import type { createCardSchema } from "$lib/schemas/card";

  let {
    columnId,
    form: formData,
  }: {
    columnId: string;
    form: SuperValidated<Infer<typeof createCardSchema>>;
  } = $props();

  const { form, enhance, submitting } = superForm(untrack(() => formData), {
    resetForm: true,
    onResult: ({ result }) => {
      adding = false;
      if (result.type === "success") {
        toast.success("Card added");
      } else if (result.type === "error") {
        toast.error("Failed to add card");
      }
    },
  });

  let adding = $state(false);
</script>

{#if adding}
  <form
    method="POST"
    action="?/createCard"
    use:enhance
    class="space-y-2 px-1.5 pb-1.5"
  >
    <input type="hidden" name="columnId" value={columnId} />
    <Input
      name="title"
      bind:value={$form.title}
      placeholder="Card title..."
      class="h-8 text-sm"
      autofocus
    />
    <div class="flex items-center gap-1.5">
      <Button type="submit" size="sm" class="h-7 px-3 text-xs" disabled={$submitting}>
        {#if $submitting}
          <LoaderCircleIcon class="size-3 animate-spin" />
        {/if}
        Add
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
{:else}
  <div class="px-1.5 pb-1.5">
    <Button
      variant="ghost"
      class="h-8 w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      size="sm"
      onclick={() => (adding = true)}
    >
      <PlusIcon class="size-3.5" />
      Add card
    </Button>
  </div>
{/if}
