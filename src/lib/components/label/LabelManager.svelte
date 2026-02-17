<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { LABEL_COLORS } from "$lib/utils/label-colors";
  import type { LabelRef } from "$lib/types";

  let { labels: boardLabels }: { labels: LabelRef[] } = $props();

  let editingId = $state<string | null>(null);
  let editName = $state("");
  let editColor = $state("");
  let editSubmitting = $state(false);

  let newName = $state("");
  let newColor: string = $state(LABEL_COLORS[0].value);
  let createSubmitting = $state(false);

  let deleteTarget = $state<LabelRef | null>(null);
  let deleteDialogOpen = $state(false);
  let deleteSubmitting = $state(false);
  let deleteFormEl = $state<HTMLFormElement | undefined>();

  function startEdit(label: LabelRef) {
    editingId = label.id;
    editName = label.name;
    editColor = label.color;
  }

  function cancelEdit() {
    editingId = null;
    editName = "";
    editColor = "";
  }

  function resetCreate() {
    newName = "";
    newColor = LABEL_COLORS[0].value;
  }

  function openDeleteDialog(label: LabelRef) {
    deleteTarget = label;
    deleteDialogOpen = true;
  }
</script>

{#snippet colorPicker(selectedColor: string, onSelect: (color: string) => void)}
  <div class="flex flex-wrap gap-1.5">
    {#each LABEL_COLORS as c (c.value)}
      <button
        type="button"
        class="size-6 rounded-full transition-shadow {selectedColor === c.value
          ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
          : 'hover:ring-2 hover:ring-muted-foreground/40 hover:ring-offset-1 hover:ring-offset-background'}"
        style="background-color: {c.value}"
        title={c.name}
        onclick={() => onSelect(c.value)}
      ></button>
    {/each}
  </div>
{/snippet}

<div class="space-y-4">
  <!-- Existing labels -->
  {#if boardLabels.length > 0}
    <div class="space-y-1">
      {#each boardLabels as label (label.id)}
        {#if editingId === label.id}
          <!-- Edit mode -->
          <form
            method="POST"
            action="?/updateLabel"
            use:enhance={() => {
              editSubmitting = true;
              return async ({ update, result }) => {
                editSubmitting = false;
                await update();
                if (result.type === "success") {
                  toast.success("Label updated");
                  cancelEdit();
                } else {
                  toast.error("Failed to update label");
                }
              };
            }}
            class="rounded-lg border border-border bg-muted/30 p-3 space-y-3"
          >
            <input type="hidden" name="labelId" value={label.id} />
            <input type="hidden" name="color" value={editColor} />
            {@render colorPicker(editColor, (c) => (editColor = c))}
            <div class="flex gap-2">
              <Input
                name="name"
                bind:value={editName}
                placeholder="Label name"
                maxlength={50}
                class="h-8 flex-1 text-sm"
              />
              <Button type="submit" size="sm" class="h-8 gap-1" disabled={editSubmitting || !editName.trim()}>
                {#if editSubmitting}
                  <LoaderCircleIcon class="size-3 animate-spin" />
                {:else}
                  <CheckIcon class="size-3" />
                {/if}
                Save
              </Button>
              <Button type="button" variant="ghost" size="sm" class="h-8" onclick={cancelEdit}>
                <XIcon class="size-3" />
              </Button>
            </div>
          </form>
        {:else}
          <!-- Display mode -->
          <div class="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
            <span
              class="size-4 shrink-0 rounded"
              style="background-color: {label.color}"
            ></span>
            <span class="flex-1 truncate text-sm">{label.name}</span>
            <div class="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                class="size-7"
                onclick={() => startEdit(label)}
              >
                <PencilIcon class="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 text-destructive hover:text-destructive"
                onclick={() => openDeleteDialog(label)}
              >
                <Trash2Icon class="size-3" />
              </Button>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="py-4 text-center text-sm text-muted-foreground">
      No labels yet. Create one below.
    </p>
  {/if}

  <!-- Create new label -->
  <div class="border-t border-border pt-4">
    <p class="mb-3 text-sm font-medium leading-none">New label</p>
    <form
      method="POST"
      action="?/createLabel"
      use:enhance={() => {
        createSubmitting = true;
        return async ({ update, result }) => {
          createSubmitting = false;
          await update();
          if (result.type === "success") {
            toast.success("Label created");
            resetCreate();
          } else {
            toast.error("Failed to create label");
          }
        };
      }}
      class="space-y-3"
    >
      <input type="hidden" name="color" value={newColor} />
      {@render colorPicker(newColor, (c) => (newColor = c))}
      <div class="flex gap-2">
        <Input
          name="name"
          bind:value={newName}
          placeholder="Label name"
          maxlength={50}
          class="h-8 flex-1 text-sm"
        />
        <Button type="submit" variant="secondary" size="sm" class="h-8 gap-1" disabled={createSubmitting || !newName.trim()}>
          {#if createSubmitting}
            <LoaderCircleIcon class="size-3 animate-spin" />
          {:else}
            <PlusIcon class="size-3" />
          {/if}
          Add
        </Button>
      </div>
    </form>
  </div>
</div>

<!-- Shared delete confirmation dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen} onOpenChange={(open) => { if (!open) deleteTarget = null; }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete label?</AlertDialog.Title>
      <AlertDialog.Description>
        {#if deleteTarget}
          This will remove <strong>{deleteTarget.name}</strong> from all cards on this board.
          This action cannot be undone.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        class="bg-destructive text-white hover:bg-destructive/90"
        onclick={() => { deleteSubmitting = true; deleteFormEl?.requestSubmit(); }}
        disabled={deleteSubmitting}
      >
        {#if deleteSubmitting}
          <LoaderCircleIcon class="size-3.5 animate-spin" />
        {/if}
        Delete
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Hidden delete form (shared, labelId set via deleteTarget) -->
{#if deleteTarget}
  <form
    bind:this={deleteFormEl}
    method="POST"
    action="?/deleteLabel"
    class="hidden"
    use:enhance={() => {
      return async ({ update, result }) => {
        deleteSubmitting = false;
        deleteDialogOpen = false;
        deleteTarget = null;
        await update();
        if (result.type === "success") {
          toast.success("Label deleted");
        } else {
          toast.error("Failed to delete label");
        }
      };
    }}
  >
    <input type="hidden" name="labelId" value={deleteTarget.id} />
  </form>
{/if}
