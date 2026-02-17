<script lang="ts">
  import CardDetail from "$lib/components/card/CardDetail.svelte";

  let { data } = $props();
</script>

<CardDetail card={data.card} boardId={data.boardId} columns={data.columns} boardLabels={data.boardLabels} updateForm={data.updateForm} currentUserId={data.currentUserId} />
