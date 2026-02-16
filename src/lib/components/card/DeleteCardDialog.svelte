<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";

  let {
    card,
    boardId,
    open = $bindable(false),
  }: {
    card: { id: string; title: string };
    boardId: string;
    open: boolean;
  } = $props();

  let deleteFormEl: HTMLFormElement | undefined = $state();
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete card?</AlertDialog.Title>
      <AlertDialog.Description>
        <strong class="font-medium text-foreground">"{card.title}"</strong> will be permanently
        deleted along with its comments. This cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        class="bg-destructive text-white hover:bg-destructive/90"
        onclick={() => deleteFormEl?.requestSubmit()}
      >
        Delete card
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<form
  bind:this={deleteFormEl}
  method="POST"
  action="/boards/{boardId}?/deleteCard"
  class="hidden"
>
  <input type="hidden" name="cardId" value={card.id} />
</form>
