<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";

  let { data } = $props();

  const { form, enhance, errors } = superForm(data.form, {
    onResult: ({ result }) => {
      if (result.type === "redirect") {
        toast.success("Board created");
      } else if (result.type === "error") {
        toast.error("Failed to create board");
      }
    },
  });

  let descriptionLength = $derived($form.description?.length ?? 0);
</script>

<div class="flex items-start justify-center px-4 py-12 sm:py-20">
  <div class="w-full max-w-md">
    <a
      href="/"
      class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon class="size-3.5" />
      Back to boards
    </a>

    <Card.Root>
      <Card.Header>
        <Card.Title class="text-lg">Create Board</Card.Title>
        <Card.Description>
          Set up a new board to organize your tasks. You can always change these later.
        </Card.Description>
      </Card.Header>

      <Card.Content>
        <form method="POST" use:enhance class="space-y-5">
          <div class="space-y-2">
            <label for="board-name" class="text-sm font-medium leading-none">
              Name <span class="text-destructive">*</span>
            </label>
            <Input
              id="board-name"
              name="name"
              bind:value={$form.name}
              placeholder="e.g. Product Roadmap"
              maxlength={100}
              aria-invalid={$errors.name ? "true" : undefined}
            />
            {#if $errors.name}
              <p class="text-[0.8rem] text-destructive">{$errors.name[0]}</p>
            {/if}
          </div>

          <div class="space-y-2">
            <label for="board-description" class="text-sm font-medium leading-none">
              Description
            </label>
            <textarea
              id="board-description"
              name="description"
              bind:value={$form.description}
              placeholder="What is this board for?"
              maxlength={500}
              rows={3}
              aria-invalid={$errors.description ? "true" : undefined}
              class="border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground placeholder:text-muted-foreground flex w-full min-w-0 resize-none rounded-md border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 md:text-sm"
            ></textarea>
            <div class="flex items-center justify-between">
              {#if $errors.description}
                <p class="text-[0.8rem] text-destructive">{$errors.description[0]}</p>
              {:else}
                <span></span>
              {/if}
              <span class="text-xs text-muted-foreground tabular-nums">
                {descriptionLength}/500
              </span>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" href="/">Cancel</Button>
            <Button type="submit">Create Board</Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>
  </div>
</div>
