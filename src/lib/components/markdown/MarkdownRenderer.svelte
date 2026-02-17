<script lang="ts">
  import { marked } from "marked";
  import DOMPurify from "dompurify";

  let {
    content,
    class: className = "",
  }: {
    content: string;
    class?: string;
  } = $props();

  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  let html = $derived(DOMPurify.sanitize(marked.parse(content) as string));
</script>

<div class="prose prose-sm dark:prose-invert max-w-none {className}">
  {@html html}
</div>
