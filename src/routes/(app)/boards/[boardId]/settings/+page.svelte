<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { superForm } from "sveltekit-superforms";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import { untrack } from "svelte";
  import LabelManager from "$lib/components/label/LabelManager.svelte";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import StarIcon from "@lucide/svelte/icons/star";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  let { data } = $props();

  const {
    form: renameFormData,
    enhance: renameEnhance,
    errors: renameErrors,
    submitting: renameSubmitting,
  } = superForm(untrack(() => data.renameForm), {
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Board renamed");
      } else if (result.type === "error") {
        toast.error("Failed to rename board");
      }
    },
  });

  const {
    form: descFormData,
    enhance: descEnhance,
    errors: descErrors,
    submitting: descSubmitting,
  } = superForm(untrack(() => data.descriptionForm), {
    onResult: ({ result }) => {
      if (result.type === "success") {
        toast.success("Description updated");
      } else if (result.type === "error") {
        toast.error("Failed to update description");
      }
    },
  });

  let descriptionLength = $derived($descFormData.description?.length ?? 0);
  let deleteDialogOpen = $state(false);
  let deleteFormEl: HTMLFormElement | undefined = $state();
  let favSubmitting = $state(false);
  let deleting = $state(false);
</script>

<div class="mx-auto max-w-2xl px-4 py-10">
  <a
    href="/boards/{data.board.id}"
    class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
  >
    <ArrowLeftIcon class="size-3.5" />
    Back to board
  </a>

  <h1 class="mb-8 text-2xl font-bold tracking-tight">Board Settings</h1>

  <div class="space-y-8">
    <!-- General -->
    <Card.Root>
      <Card.Header>
        <Card.Title>General</Card.Title>
        <Card.Description>Manage your board's name and description.</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Rename -->
        <form method="POST" action="?/rename" use:renameEnhance class="space-y-3">
          <label for="board-name" class="text-sm font-medium leading-none">Name</label>
          <div class="flex gap-2">
            <Input
              id="board-name"
              name="name"
              bind:value={$renameFormData.name}
              placeholder="Board name"
              maxlength={100}
              class="flex-1"
              aria-invalid={$renameErrors.name ? "true" : undefined}
            />
            <Button type="submit" variant="secondary" size="sm" class="h-9" disabled={$renameSubmitting}>
              {#if $renameSubmitting}
                <LoaderCircleIcon class="size-3.5 animate-spin" />
              {/if}
              Save
            </Button>
          </div>
          {#if $renameErrors.name}
            <p class="text-[0.8rem] text-destructive">{$renameErrors.name[0]}</p>
          {/if}
        </form>

        <div class="h-px bg-border" />

        <!-- Description -->
        <form method="POST" action="?/updateDescription" use:descEnhance class="space-y-3">
          <label for="board-description" class="text-sm font-medium leading-none">
            Description
          </label>
          <textarea
            id="board-description"
            name="description"
            bind:value={$descFormData.description}
            placeholder="What is this board for?"
            maxlength={500}
            rows={3}
            aria-invalid={$descErrors.description ? "true" : undefined}
            class="border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground placeholder:text-muted-foreground flex w-full min-w-0 resize-none rounded-md border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 md:text-sm"
          ></textarea>
          <div class="flex items-center justify-between">
            <div>
              {#if $descErrors.description}
                <p class="text-[0.8rem] text-destructive">{$descErrors.description[0]}</p>
              {/if}
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground tabular-nums">
                {descriptionLength}/500
              </span>
              <Button type="submit" variant="secondary" size="sm" disabled={$descSubmitting}>
                {#if $descSubmitting}
                  <LoaderCircleIcon class="size-3.5 animate-spin" />
                {/if}
                Save
              </Button>
            </div>
          </div>
        </form>

        <div class="h-px bg-border" />

        <!-- Favorite toggle -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Favorite</p>
            <p class="text-sm text-muted-foreground">
              Pin this board to the top of your sidebar.
            </p>
          </div>
          <form
            method="POST"
            action="?/toggleFavorite"
            use:enhance={() => {
              favSubmitting = true;
              return async ({ update, result }) => {
                favSubmitting = false;
                await update();
                if (result.type === "success") {
                  toast.success(
                    data.board.isFavorite ? "Removed from favorites" : "Added to favorites"
                  );
                } else if (result.type === "error") {
                  toast.error("Failed to update favorite status");
                }
              };
            }}
          >
            <Button
              type="submit"
              variant={data.board.isFavorite ? "secondary" : "outline"}
              size="sm"
              class="gap-1.5"
              disabled={favSubmitting}
            >
              {#if favSubmitting}
                <LoaderCircleIcon class="size-3.5 animate-spin" />
              {:else}
                <StarIcon
                  class="size-3.5 {data.board.isFavorite
                    ? 'fill-amber-400 text-amber-400 dark:fill-amber-300 dark:text-amber-300'
                    : 'text-muted-foreground'}"
                />
              {/if}
              {data.board.isFavorite ? "Favorited" : "Add to favorites"}
            </Button>
          </form>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Labels -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Labels</Card.Title>
        <Card.Description>Create and manage labels for categorizing cards.</Card.Description>
      </Card.Header>
      <Card.Content>
        <LabelManager labels={data.boardLabels} />
      </Card.Content>
    </Card.Root>

    <!-- Danger Zone -->
    <Card.Root class="border-destructive/40">
      <Card.Header>
        <Card.Title class="text-destructive">Danger Zone</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium">Delete this board</p>
            <p class="text-sm text-muted-foreground">
              Permanently remove this board and all its data. This cannot be undone.
            </p>
          </div>

          <AlertDialog.Root bind:open={deleteDialogOpen}>
            <AlertDialog.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="destructive" size="sm" class="shrink-0 gap-1.5">
                  <Trash2Icon class="size-3.5" />
                  Delete
                </Button>
              {/snippet}
            </AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Delete board?</AlertDialog.Title>
                <AlertDialog.Description>
                  This will permanently delete <strong>{data.board.name}</strong> and all its
                  columns, cards, labels, and activity. This action cannot be undone.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action
                  class="bg-destructive text-white hover:bg-destructive/90"
                  onclick={() => { deleting = true; deleteFormEl?.requestSubmit(); }}
                  disabled={deleting}
                >
                  {#if deleting}
                    <LoaderCircleIcon class="size-3.5 animate-spin" />
                  {/if}
                  Delete board
                </AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Root>
        </div>

        <form
          bind:this={deleteFormEl}
          method="POST"
          action="?/delete"
          class="hidden"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === "redirect") {
                toast.success("Board deleted");
                const { goto } = await import("$app/navigation");
                goto(result.location);
              } else if (result.type === "error") {
                deleting = false;
                toast.error("Failed to delete board");
              }
            };
          }}
        ></form>
      </Card.Content>
    </Card.Root>
  </div>
</div>
