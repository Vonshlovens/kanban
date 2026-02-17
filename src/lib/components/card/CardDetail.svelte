<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  import { untrack } from "svelte";
  import { cn } from "$lib/utils";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightLeftIcon from "@lucide/svelte/icons/arrow-right-left";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import ColumnsIcon from "@lucide/svelte/icons/columns-3";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import TagIcon from "@lucide/svelte/icons/tag";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import DeleteCardDialog from "./DeleteCardDialog.svelte";
  import MoveCardDialog from "./MoveCardDialog.svelte";
  import CommentList from "$lib/components/comment/CommentList.svelte";
  import MarkdownRenderer from "$lib/components/markdown/MarkdownRenderer.svelte";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import type { SuperValidated } from "sveltekit-superforms";
  import type { updateCardSchema } from "$lib/schemas/card";
  import type { z } from "zod/v4";
  import type { CardDetail as CardDetailType, ColumnRef } from "$lib/types";

  type UpdateCardForm = z.infer<typeof updateCardSchema>;

  let {
    card,
    boardId,
    columns,
    updateForm,
    currentUserId,
  }: {
    card: CardDetailType;
    boardId: string;
    columns: ColumnRef[];
    updateForm: SuperValidated<UpdateCardForm>;
    currentUserId: string;
  } = $props();

  const {
    form: formData,
    enhance: updateEnhance,
    errors: formErrors,
    submitting: updateSubmitting,
  } = superForm(untrack(() => updateForm), {
    onResult: ({ result }) => {
      titleSubmitting = false;
      if (result.type === "success") {
        editingTitle = false;
        editingDescription = false;
        toast.success("Card updated");
      } else if (result.type === "error") {
        toast.error("Failed to update card");
      }
    },
  });

  let editingTitle = $state(false);
  let titleSubmitting = $state(false);
  let editingDescription = $state(false);
  let showDelete = $state(false);
  let showMove = $state(false);
  let hasOtherColumns = $derived(columns.filter((c) => c.id !== card.column.id).length > 0);
  let titleInputEl: HTMLInputElement | undefined = $state();

  let labelCount = $derived(card.cardLabels?.length ?? 0);
  let commentCount = $derived(card.comments?.length ?? 0);

  let createdDate = $derived(
    new Date(card.createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  );

  let updatedDate = $derived(
    new Date(card.updatedAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  );

  let dueDateFormatted = $derived(
    card.dueDate
      ? new Date(card.dueDate).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null,
  );

  function startEditingTitle() {
    editingTitle = true;
    // Focus the input after it renders
    requestAnimationFrame(() => {
      titleInputEl?.focus();
      titleInputEl?.select();
    });
  }

  let titleFormEl: HTMLFormElement | undefined = $state();

  function handleTitleBlur() {
    if (titleSubmitting) return;
    if ($formData.title && $formData.title !== card.title) {
      titleFormEl?.requestSubmit();
    } else {
      editingTitle = false;
    }
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if ($formData.title && $formData.title !== card.title) {
        titleSubmitting = true;
        titleFormEl?.requestSubmit();
      } else {
        editingTitle = false;
      }
    } else if (e.key === "Escape") {
      $formData.title = card.title;
      editingTitle = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl px-4 py-8">
  <!-- Navigation -->
  <div class="mb-8 flex items-center gap-3">
    <a
      href="/boards/{boardId}"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon class="size-3.5" />
      Back to board
    </a>
    <span class="text-muted-foreground/40">/</span>
    <span
      class="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
    >
      <ColumnsIcon class="size-3" />
      {card.column.name}
    </span>
  </div>

  <!-- Title -->
  <div class="group/title mb-8">
    {#if editingTitle}
      <form
        bind:this={titleFormEl}
        method="POST"
        action="?/update"
        use:updateEnhance
      >
        <Input
          bind:ref={titleInputEl}
          name="title"
          bind:value={$formData.title}
          class="h-auto border-none bg-transparent p-0 text-2xl font-bold tracking-tight shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          onblur={handleTitleBlur}
          onkeydown={handleTitleKeydown}
        />
      </form>
    {:else}
      <button
        class="flex w-full items-start gap-2 text-left"
        onclick={startEditingTitle}
      >
        <h1 class="flex-1 text-2xl font-bold tracking-tight text-foreground">
          {card.title}
        </h1>
        <PencilIcon
          class="mt-1.5 size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover/title:text-muted-foreground"
        />
      </button>
    {/if}
    {#if $formErrors.title}
      <p class="mt-1 text-[0.8rem] text-destructive">{$formErrors.title?.[0]}</p>
    {/if}
  </div>

  <div class="space-y-6">
    <!-- Description -->
    <Card.Root>
      <Card.Header class="pb-3">
        <Card.Title class="text-sm font-medium text-muted-foreground"
          >Description</Card.Title
        >
      </Card.Header>
      <Card.Content>
        {#if editingDescription}
          <form method="POST" action="?/update" use:updateEnhance class="space-y-3">
            <Tabs.Root value="write">
              <Tabs.List>
                <Tabs.Trigger value="write">Write</Tabs.Trigger>
                <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="write">
                <textarea
                  id="card-description"
                  name="description"
                  bind:value={$formData.description}
                  placeholder="Add a description... (Markdown supported)"
                  rows={8}
                  maxlength={10000}
                  class={cn(
                    "border-input bg-background placeholder:text-muted-foreground",
                    "flex w-full min-w-0 resize-y rounded-md border px-3 py-2 text-sm font-mono",
                    "shadow-xs transition-[color,box-shadow] outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "dark:bg-input/30",
                  )}
                ></textarea>
              </Tabs.Content>
              <Tabs.Content value="preview">
                <div class="min-h-[120px] rounded-md border border-input px-3 py-2">
                  {#if $formData.description}
                    <MarkdownRenderer content={String($formData.description)} />
                  {:else}
                    <p class="text-sm text-muted-foreground">Nothing to preview</p>
                  {/if}
                </div>
              </Tabs.Content>
            </Tabs.Root>
            <div class="flex items-center justify-between">
              <div>
                {#if $formErrors.description}
                  <p class="text-[0.8rem] text-destructive">
                    {$formErrors.description?.[0]}
                  </p>
                {/if}
              </div>
              <div class="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onclick={() => {
                    $formData.description = card.description ?? "";
                    editingDescription = false;
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" size="sm" disabled={$updateSubmitting}>
                  {#if $updateSubmitting}
                    <LoaderCircleIcon class="size-3.5 animate-spin" />
                  {/if}
                  Save
                </Button>
              </div>
            </div>
          </form>
        {:else}
          <button
            type="button"
            class="group/desc w-full text-left"
            onclick={() => (editingDescription = true)}
          >
            {#if $formData.description}
              <div class="relative">
                <MarkdownRenderer content={String($formData.description)} />
                <PencilIcon
                  class="absolute top-0 right-0 size-3.5 text-muted-foreground/0 transition-colors group-hover/desc:text-muted-foreground"
                />
              </div>
            {:else}
              <p class="rounded-md border border-dashed border-input px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50">
                Add a description...
              </p>
            {/if}
          </button>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Labels -->
    {#if labelCount > 0}
      <Card.Root>
        <Card.Header class="pb-3">
          <Card.Title class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TagIcon class="size-3.5" />
            Labels
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <div class="flex flex-wrap gap-2">
            {#each card.cardLabels as cl (cl.label.id)}
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style="background-color: {cl.label.color}20; color: {cl.label.color}; border: 1px solid {cl.label.color}30;"
              >
                <span
                  class="size-2 rounded-full"
                  style="background-color: {cl.label.color}"
                ></span>
                {cl.label.name}
              </span>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}

    <!-- Metadata -->
    <Card.Root>
      <Card.Header class="pb-3">
        <Card.Title class="text-sm font-medium text-muted-foreground">Details</Card.Title>
      </Card.Header>
      <Card.Content>
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt class="flex items-center gap-2 text-muted-foreground">
            <ColumnsIcon class="size-3.5" />
            Column
          </dt>
          <dd class="flex items-center gap-2">
            <span class="font-medium">{card.column.name}</span>
            {#if hasOtherColumns}
              <Button
                variant="ghost"
                size="sm"
                class="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onclick={() => (showMove = true)}
              >
                <ArrowRightLeftIcon class="size-3" />
                Move
              </Button>
            {/if}
          </dd>

          {#if dueDateFormatted}
            <dt class="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon class="size-3.5" />
              Due date
            </dt>
            <dd class="font-medium">{dueDateFormatted}</dd>
          {/if}

          <dt class="flex items-center gap-2 text-muted-foreground">
            <ClockIcon class="size-3.5" />
            Created
          </dt>
          <dd>{createdDate}</dd>

          <dt class="flex items-center gap-2 text-muted-foreground">
            <PencilIcon class="size-3.5" />
            Updated
          </dt>
          <dd>{updatedDate}</dd>
        </dl>
      </Card.Content>
    </Card.Root>

    <!-- Comments -->
    <Card.Root>
      <Card.Header class="pb-3">
        <Card.Title class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MessageSquareIcon class="size-3.5" />
          Comments ({commentCount})
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <CommentList cardId={card.id} comments={card.comments} {currentUserId} />
      </Card.Content>
    </Card.Root>

    <!-- Danger Zone -->
    <Card.Root class="border-destructive/30">
      <Card.Content class="py-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium">Delete this card</p>
            <p class="text-sm text-muted-foreground">
              Permanently remove this card and all its data.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            class="shrink-0 gap-1.5"
            onclick={() => (showDelete = true)}
          >
            <Trash2Icon class="size-3.5" />
            Delete
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>

<DeleteCardDialog bind:open={showDelete} {card} {boardId} />
<MoveCardDialog bind:open={showMove} {card} {boardId} {columns} currentColumnId={card.column.id} />
