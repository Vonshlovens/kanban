<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import SendIcon from "@lucide/svelte/icons/send";
  import CommentItem from "./CommentItem.svelte";
  import { enhance } from "$app/forms";
  import { toast } from "svelte-sonner";
  import { cn } from "$lib/utils";
  import type { CommentWithAuthor } from "$lib/types";

  let {
    cardId,
    comments,
    currentUserId,
  }: {
    cardId: string;
    comments: CommentWithAuthor[];
    currentUserId: string;
  } = $props();

  let newComment = $state("");
  let editingId = $state<string | null>(null);
  let editContent = $state("");
  let submittingNew = $state(false);
  let submittingEdit = $state(false);
  let editTextareaEl: HTMLTextAreaElement | undefined = $state();

  function startEdit(commentId: string, content: string) {
    editingId = commentId;
    editContent = content;
    requestAnimationFrame(() => {
      editTextareaEl?.focus();
    });
  }

  function cancelEdit() {
    editingId = null;
    editContent = "";
  }

  const textareaClass = cn(
    "border-input bg-background placeholder:text-muted-foreground",
    "flex w-full min-w-0 resize-none rounded-md border px-3 py-2 text-sm",
    "shadow-xs transition-[color,box-shadow] outline-none",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "dark:bg-input/30",
  );
</script>

<div class="space-y-4">
  {#if comments.length > 0}
    <div class="space-y-1">
      {#each comments as comment (comment.id)}
        {#if editingId === comment.id}
          <form
            method="POST"
            action="?/updateComment"
            use:enhance={() => {
              submittingEdit = true;
              return async ({ update, result }) => {
                await update();
                submittingEdit = false;
                if (result.type === "success") {
                  cancelEdit();
                  toast.success("Comment updated");
                } else {
                  toast.error("Failed to update comment");
                }
              };
            }}
            class="flex gap-3 rounded-lg bg-muted/30 p-2 -mx-2"
          >
            <input type="hidden" name="commentId" value={comment.id} />
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
            <div class="min-w-0 flex-1 space-y-2">
              <textarea
                bind:this={editTextareaEl}
                name="content"
                bind:value={editContent}
                class={textareaClass}
                rows={3}
                onkeydown={(e) => {
                  if (e.key === "Escape") cancelEdit();
                }}
              ></textarea>
              <div class="flex items-center gap-1.5">
                <Button type="submit" size="sm" class="h-7 px-3 text-xs" disabled={submittingEdit || !editContent.trim()}>
                  {#if submittingEdit}
                    <LoaderCircleIcon class="size-3 animate-spin" />
                  {/if}
                  Save
                </Button>
                <Button variant="ghost" size="sm" class="h-7 px-3 text-xs" onclick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        {:else}
          <CommentItem {comment} {currentUserId} onEdit={startEdit} />
        {/if}
      {/each}
    </div>
  {:else}
    <p class="text-sm text-muted-foreground/60">No comments yet.</p>
  {/if}

  <!-- New comment form -->
  <form
    method="POST"
    action="?/createComment"
    use:enhance={() => {
      submittingNew = true;
      return async ({ update, result }) => {
        await update();
        submittingNew = false;
        if (result.type === "success") {
          newComment = "";
          toast.success("Comment added");
        } else {
          toast.error("Failed to add comment");
        }
      };
    }}
    class="flex gap-2 items-end"
  >
    <input type="hidden" name="cardId" value={cardId} />
    <textarea
      name="content"
      bind:value={newComment}
      placeholder="Write a comment..."
      class={textareaClass}
      rows={2}
      onkeydown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (newComment.trim()) {
            e.currentTarget.closest("form")?.requestSubmit();
          }
        }
      }}
    ></textarea>
    <Button
      type="submit"
      size="icon"
      class="h-9 w-9 shrink-0"
      disabled={submittingNew || !newComment.trim()}
    >
      {#if submittingNew}
        <LoaderCircleIcon class="size-4 animate-spin" />
      {:else}
        <SendIcon class="size-4" />
      {/if}
    </Button>
  </form>
</div>
