<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import type { CommentWithAuthor } from "$lib/types";

  let {
    comment,
    currentUserId,
    onEdit,
  }: {
    comment: CommentWithAuthor;
    currentUserId: string;
    onEdit: (commentId: string, content: string) => void;
  } = $props();

  let isAuthor = $derived(currentUserId === comment.author.id);
  let isEdited = $derived(
    new Date(comment.updatedAt).getTime() >
      new Date(comment.createdAt).getTime() + 1000,
  );

  let confirmingDelete = $state(false);
  let deleting = $state(false);

  let initials = $derived(
    comment.author.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  );

  let timestamp = $derived(
    new Date(comment.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  );
</script>

<div class="group/comment flex gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/50">
  <div
    class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
  >
    {initials}
  </div>
  <div class="min-w-0 flex-1">
    <div class="flex items-baseline gap-2">
      <span class="text-sm font-medium">{comment.author.name}</span>
      <span class="text-xs text-muted-foreground">{timestamp}</span>
      {#if isEdited}
        <span class="text-xs text-muted-foreground/60">(edited)</span>
      {/if}
    </div>
    <p class="mt-1 text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
      {comment.content}
    </p>
  </div>

  {#if isAuthor}
    <div class="flex gap-0.5 shrink-0 self-start opacity-0 group-hover/comment:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        onclick={() => onEdit(comment.id, comment.content)}
      >
        <PencilIcon class="size-3" />
      </Button>
      {#if confirmingDelete}
        <form
          method="POST"
          action="?/deleteComment"
          use:enhance={() => {
            deleting = true;
            return async ({ update, result }) => {
              await update();
              if (result.type === "success") {
                toast.success("Comment deleted");
              } else {
                deleting = false;
                confirmingDelete = false;
                toast.error("Failed to delete comment");
              }
            };
          }}
        >
          <input type="hidden" name="commentId" value={comment.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={deleting}
          >
            {#if deleting}
              <LoaderCircleIcon class="size-3 animate-spin" />
            {:else}
              <Trash2Icon class="size-3" />
            {/if}
          </Button>
        </form>
      {:else}
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-muted-foreground"
          onclick={() => (confirmingDelete = true)}
          onblur={() => setTimeout(() => (confirmingDelete = false), 200)}
        >
          <Trash2Icon class="size-3" />
        </Button>
      {/if}
    </div>
  {/if}
</div>
