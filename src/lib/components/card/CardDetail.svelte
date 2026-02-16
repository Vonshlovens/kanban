<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";
  import { cn } from "$lib/utils";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import ColumnsIcon from "@lucide/svelte/icons/columns-3";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import TagIcon from "@lucide/svelte/icons/tag";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import DeleteCardDialog from "./DeleteCardDialog.svelte";
  import type { SuperValidated } from "sveltekit-superforms";

  let {
    card,
    boardId,
    updateForm,
  }: {
    card: {
      id: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      position: number;
      createdAt: Date;
      updatedAt: Date;
      column: { id: string; name: string };
      cardLabels: { label: { id: string; name: string; color: string } }[];
      comments: {
        id: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        author: { id: string; name: string; avatarUrl: string | null };
      }[];
    };
    boardId: string;
    updateForm: SuperValidated<Record<string, unknown>>;
  } = $props();

  const {
    form: formData,
    enhance: updateEnhance,
    errors: formErrors,
    submitting: updateSubmitting,
  } = superForm(updateForm, {
    onResult: ({ result }) => {
      if (result.type === "success") {
        editingTitle = false;
        toast.success("Card updated");
      } else if (result.type === "error") {
        toast.error("Failed to update card");
      }
    },
  });

  let editingTitle = $state(false);
  let showDelete = $state(false);
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
    if ($formData.title && $formData.title !== card.title) {
      titleFormEl?.requestSubmit();
    } else {
      editingTitle = false;
    }
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleBlur();
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
      <p class="mt-1 text-[0.8rem] text-destructive">{$formErrors.title[0]}</p>
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
        <form method="POST" action="?/update" use:updateEnhance class="space-y-3">
          <textarea
            id="card-description"
            name="description"
            bind:value={$formData.description}
            placeholder="Add a description..."
            rows={5}
            maxlength={10000}
            class={cn(
              "border-input bg-background placeholder:text-muted-foreground",
              "flex w-full min-w-0 resize-none rounded-md border px-3 py-2 text-sm",
              "shadow-xs transition-[color,box-shadow] outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "dark:bg-input/30",
            )}
          ></textarea>
          <div class="flex items-center justify-between">
            <div>
              {#if $formErrors.description}
                <p class="text-[0.8rem] text-destructive">
                  {$formErrors.description[0]}
                </p>
              {/if}
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={$updateSubmitting}>
              {#if $updateSubmitting}
                <LoaderCircleIcon class="size-3.5 animate-spin" />
              {/if}
              Save
            </Button>
          </div>
        </form>
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
        {#if commentCount > 0}
          <div class="space-y-4">
            {#each card.comments as comment (comment.id)}
              <div class="flex gap-3">
                <div
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
                >
                  {comment.author.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2">
                    <span class="text-sm font-medium">{comment.author.name}</span>
                    <span class="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {#if new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime() + 1000}
                      <span class="text-xs text-muted-foreground/60">(edited)</span>
                    {/if}
                  </div>
                  <p class="mt-1 text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-muted-foreground/60">
            No comments yet.
          </p>
        {/if}
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
