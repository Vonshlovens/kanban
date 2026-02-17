# Editor, Diff, and Logs

## Overview

Rich text editing, diff rendering, log streaming, preview panels, and terminal surfaces for the kanban app.

### Current Implementation (Markdown)

Card descriptions currently use a lightweight **Markdown** approach: descriptions are stored as plain Markdown text, rendered with `marked` (GFM), and sanitized with `DOMPurify`. The `MarkdownRenderer` component (`src/lib/components/markdown/MarkdownRenderer.svelte`) handles rendering with `@tailwindcss/typography` prose styling. The card detail view uses a read/edit toggle with Write/Preview tabs.

### Planned (TipTap WYSIWYG)

The WYSIWYG editor uses TipTap (a ProseMirror wrapper with first-class Svelte support) for card descriptions and comments. This is a planned upgrade from the current Markdown approach that would add toolbar-based formatting, slash commands, and image embedding. Diff rendering uses `diff2html` for unified/split diff views. Logs are virtualized with `@tanstack/svelte-virtual`. Preview panels embed dev server output via iframes. Terminal surfaces use `@xterm/xterm` with a Svelte wrapper.

## Requirements

### Rich Text Editor
- Card descriptions and comments support rich text (bold, italic, strikethrough, links, lists, code blocks, images)
- Toolbar with formatting buttons and keyboard shortcuts
- Slash command menu for inserting blocks (headings, lists, code, images)
- Markdown paste support — pasting markdown renders as rich text
- Output stored as HTML string in the database

### Diff Rendering
- Display file diffs in unified or split view
- Syntax highlighting in diff hunks
- Line numbers and expand/collapse for large diffs
- Inline comments on diff lines (for review workflows)

### Logs and Processes
- Virtualized log viewer for streaming process output
- Auto-scroll to bottom with manual scroll override
- ANSI color code rendering
- Copy log contents to clipboard

### Preview and Embedded Dev Servers
- Iframe-based preview panel for dev server output
- URL bar showing current preview path
- Refresh and open-in-new-tab controls
- Dev server lifecycle management (start, stop, status)

### Terminal Surface
- Embedded terminal using xterm.js
- Multiple terminal tabs
- Resize handling
- Copy/paste support

## Dependencies

| Package | Purpose |
| --- | --- |
| `@tiptap/core` | ProseMirror-based editor framework |
| `@tiptap/starter-kit` | Bundle of common extensions (bold, italic, lists, etc.) |
| `@tiptap/extension-link` | Link support |
| `@tiptap/extension-image` | Image embedding |
| `@tiptap/extension-code-block-lowlight` | Syntax-highlighted code blocks |
| `@tiptap/extension-placeholder` | Placeholder text |
| `svelte-tiptap` | Svelte bindings for TipTap |
| `diff2html` | Diff string to HTML rendering (unified/split) |
| `@tanstack/svelte-virtual` | Virtualized list for log viewer |
| `@xterm/xterm` | Terminal emulator |
| `@xterm/addon-fit` | Auto-resize xterm to container |
| `ansi-to-html` | Convert ANSI codes to styled HTML |

## Component Patterns

### Rich Text Editor

A TipTap-based WYSIWYG editor with toolbar, slash commands, and markdown paste:

```svelte
<!-- src/lib/components/editor/RichTextEditor.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Link from "@tiptap/extension-link";
  import Image from "@tiptap/extension-image";
  import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
  import Placeholder from "@tiptap/extension-placeholder";
  import { common, createLowlight } from "lowlight";
  import {
    Bold,
    Italic,
    Strikethrough,
    List,
    ListOrdered,
    Code,
    Link as LinkIcon,
    Image as ImageIcon,
    Heading2,
    Quote,
  } from "@lucide/svelte";

  let { content = "", onUpdate, placeholder = "Write something..." }: {
    content?: string;
    onUpdate?: (html: string) => void;
    placeholder?: string;
  } = $props();

  let element: HTMLDivElement;
  let editor = $state<Editor | null>(null);
  const lowlight = createLowlight(common);

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
        }),
        Link.configure({ openOnClick: false }),
        Image,
        CodeBlockLowlight.configure({ lowlight }),
        Placeholder.configure({ placeholder }),
      ],
      content,
      onUpdate: ({ editor: e }) => {
        onUpdate?.(e.getHTML());
      },
      onTransaction: () => {
        // Force Svelte reactivity
        editor = editor;
      },
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });
</script>

{#if editor}
  <div class="rounded-lg border border-neutral-200 dark:border-neutral-700">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 px-2 py-1 dark:border-neutral-700">
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("bold")}
        class:dark:bg-neutral-700={editor.isActive("bold")}
        onclick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("italic")}
        class:dark:bg-neutral-700={editor.isActive("italic")}
        onclick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("strike")}
        class:dark:bg-neutral-700={editor.isActive("strike")}
        onclick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough class="h-4 w-4" />
      </button>
      <div class="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700"></div>
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("heading", { level: 2 })}
        class:dark:bg-neutral-700={editor.isActive("heading", { level: 2 })}
        onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("bulletList")}
        class:dark:bg-neutral-700={editor.isActive("bulletList")}
        onclick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("orderedList")}
        class:dark:bg-neutral-700={editor.isActive("orderedList")}
        onclick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("blockquote")}
        class:dark:bg-neutral-700={editor.isActive("blockquote")}
        onclick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        class:bg-neutral-200={editor.isActive("codeBlock")}
        class:dark:bg-neutral-700={editor.isActive("codeBlock")}
        onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code class="h-4 w-4" />
      </button>
    </div>

    <!-- Editor content -->
    <div
      bind:this={element}
      class="prose prose-sm dark:prose-invert max-w-none px-4 py-3 focus-within:outline-none [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:outline-none"
    ></div>
  </div>
{/if}
```

### Static Editor (Read-Only Renderer)

Renders stored HTML content with proper prose styling, without the editor overhead:

```svelte
<!-- src/lib/components/editor/RichTextContent.svelte -->
<script lang="ts">
  let { content }: { content: string } = $props();
</script>

<div class="prose prose-sm dark:prose-invert max-w-none">
  {@html content}
</div>
```

### Diff Viewer

Renders a unified or split diff using `diff2html`:

```svelte
<!-- src/lib/components/diff/DiffViewer.svelte -->
<script lang="ts">
  import { html as diff2htmlHtml } from "diff2html";
  import "diff2html/bundles/css/diff2html.min.css";

  let { diffString, outputFormat = "line-by-line" }: {
    diffString: string;
    outputFormat?: "line-by-line" | "side-by-side";
  } = $props();

  let diffHtml = $derived(
    diff2htmlHtml(diffString, {
      drawFileList: false,
      matching: "lines",
      outputFormat,
    }),
  );
</script>

<div class="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
  {@html diffHtml}
</div>

<style>
  :global(.d2h-wrapper) {
    --d2h-bg-color: transparent;
  }
  :global(.dark .d2h-code-line-ctn) {
    color: theme("colors.neutral.300");
  }
  :global(.dark .d2h-info) {
    background-color: theme("colors.neutral.800");
    color: theme("colors.neutral.400");
  }
</style>
```

### Diff View Toggle

Segmented control to switch between unified and split diff views:

```svelte
<!-- src/lib/components/diff/DiffViewToggle.svelte -->
<script lang="ts">
  import { cn } from "$lib/utils";

  let { outputFormat = $bindable("line-by-line") }: {
    outputFormat: "line-by-line" | "side-by-side";
  } = $props();
</script>

<div class="inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
  <button
    type="button"
    class={cn(
      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
      outputFormat === "line-by-line"
        ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
    )}
    onclick={() => (outputFormat = "line-by-line")}
  >
    Unified
  </button>
  <button
    type="button"
    class={cn(
      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
      outputFormat === "side-by-side"
        ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
    )}
    onclick={() => (outputFormat = "side-by-side")}
  >
    Split
  </button>
</div>
```

### Virtualized Log Viewer

Streams process output with auto-scroll, ANSI color support, and clipboard copy:

```svelte
<!-- src/lib/components/logs/LogViewer.svelte -->
<script lang="ts">
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import AnsiToHtml from "ansi-to-html";
  import { Button } from "$lib/components/ui/button";
  import { Copy, ArrowDown } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  let { lines }: { lines: string[] } = $props();

  let scrollContainer: HTMLDivElement;
  let userScrolled = $state(false);
  const convert = new AnsiToHtml({ newline: true });

  const virtualizer = createVirtualizer({
    get count() { return lines.length; },
    getScrollElement: () => scrollContainer,
    estimateSize: () => 20,
    overscan: 20,
  });

  // Auto-scroll to bottom when new lines arrive, unless user scrolled up
  $effect(() => {
    if (!userScrolled && lines.length > 0) {
      virtualizer.scrollToIndex(lines.length - 1, { align: "end" });
    }
  });

  function handleScroll() {
    if (!scrollContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    userScrolled = scrollHeight - scrollTop - clientHeight > 50;
  }

  function scrollToBottom() {
    userScrolled = false;
    virtualizer.scrollToIndex(lines.length - 1, { align: "end" });
  }

  async function copyLogs() {
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Logs copied to clipboard");
  }
</script>

<div class="relative rounded-lg border border-neutral-200 bg-neutral-950 dark:border-neutral-700">
  <!-- Controls -->
  <div class="absolute right-2 top-2 z-10 flex gap-1">
    <Button variant="ghost" size="icon" class="h-7 w-7 text-neutral-400 hover:text-neutral-200" onclick={copyLogs}>
      <Copy class="h-3 w-3" />
    </Button>
  </div>

  <!-- Virtualized log content -->
  <div
    bind:this={scrollContainer}
    onscroll={handleScroll}
    class="h-[400px] overflow-auto font-mono text-xs text-neutral-300"
  >
    <div style="height: {virtualizer.getTotalSize()}px; width: 100%; position: relative;">
      {#each virtualizer.getVirtualItems() as row (row.index)}
        <div
          style="position: absolute; top: 0; left: 0; width: 100%; height: {row.size}px; transform: translateY({row.start}px);"
          class="flex"
        >
          <span class="w-12 shrink-0 select-none pr-2 text-right text-neutral-600">
            {row.index + 1}
          </span>
          <span class="whitespace-pre-wrap break-all px-2">
            {@html convert.toHtml(lines[row.index])}
          </span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Scroll to bottom indicator -->
  {#if userScrolled}
    <button
      type="button"
      class="absolute bottom-4 right-4 rounded-full bg-neutral-800 p-2 text-neutral-400 shadow-lg hover:text-neutral-200"
      onclick={scrollToBottom}
    >
      <ArrowDown class="h-4 w-4" />
    </button>
  {/if}
</div>
```

### Preview Panel

Iframe-based preview for embedded dev server output:

```svelte
<!-- src/lib/components/preview/PreviewPanel.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { RefreshCw, ExternalLink, Globe } from "@lucide/svelte";

  let { url }: { url: string } = $props();

  let iframeRef: HTMLIFrameElement;
  let currentPath = $state("/");
  let displayUrl = $derived(url + currentPath);

  function refresh() {
    if (iframeRef) {
      iframeRef.src = displayUrl;
    }
  }

  function openExternal() {
    window.open(displayUrl, "_blank");
  }
</script>

<div class="flex h-full flex-col rounded-lg border border-neutral-200 dark:border-neutral-700">
  <!-- URL bar -->
  <div class="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
    <Globe class="h-4 w-4 shrink-0 text-neutral-400" />
    <input
      type="text"
      bind:value={currentPath}
      class="flex-1 bg-transparent text-sm text-neutral-700 outline-none dark:text-neutral-300"
      onkeydown={(e) => { if (e.key === "Enter") refresh(); }}
    />
    <Button variant="ghost" size="icon" class="h-7 w-7" onclick={refresh}>
      <RefreshCw class="h-3 w-3" />
    </Button>
    <Button variant="ghost" size="icon" class="h-7 w-7" onclick={openExternal}>
      <ExternalLink class="h-3 w-3" />
    </Button>
  </div>

  <!-- Iframe -->
  <iframe
    bind:this={iframeRef}
    src={displayUrl}
    title="Preview"
    class="flex-1 bg-white"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  ></iframe>
</div>
```

### Terminal Surface

Embedded terminal using xterm.js with resize handling:

```svelte
<!-- src/lib/components/terminal/TerminalSurface.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";

  let { onData, onResize }: {
    onData?: (data: string) => void;
    onResize?: (cols: number, rows: number) => void;
  } = $props();

  let container: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let resizeObserver: ResizeObserver;

  export function write(data: string) {
    terminal?.write(data);
  }

  export function clear() {
    terminal?.clear();
  }

  onMount(() => {
    terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#525252",
      },
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    terminal.onData((data) => onData?.(data));
    terminal.onResize(({ cols, rows }) => onResize?.(cols, rows));

    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    terminal?.dispose();
  });
</script>

<div bind:this={container} class="h-full w-full"></div>
```

### Terminal Tabs

Multi-tab terminal manager:

```svelte
<!-- src/lib/components/terminal/TerminalTabs.svelte -->
<script lang="ts">
  import { cn } from "$lib/utils";
  import { Button } from "$lib/components/ui/button";
  import { Plus, X, TerminalSquare } from "@lucide/svelte";
  import TerminalSurface from "$lib/components/terminal/TerminalSurface.svelte";

  let { tabs = $bindable([{ id: "1", label: "Terminal 1" }]) }: {
    tabs: Array<{ id: string; label: string }>;
  } = $props();

  let activeTab = $state(tabs[0]?.id ?? "1");
  let nextId = $state(2);

  function addTab() {
    const id = String(nextId++);
    tabs = [...tabs, { id, label: `Terminal ${id}` }];
    activeTab = id;
  }

  function closeTab(id: string) {
    tabs = tabs.filter((t) => t.id !== id);
    if (activeTab === id) {
      activeTab = tabs[0]?.id ?? "";
    }
  }
</script>

<div class="flex h-full flex-col">
  <!-- Tab bar -->
  <div class="flex items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-2 dark:border-neutral-700 dark:bg-neutral-900">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        class={cn(
          "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors",
          activeTab === tab.id
            ? "border-b-2 border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
        )}
        onclick={() => (activeTab = tab.id)}
      >
        <TerminalSquare class="h-3 w-3" />
        {tab.label}
        {#if tabs.length > 1}
          <button
            type="button"
            class="ml-1 rounded p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            onclick|stopPropagation={() => closeTab(tab.id)}
          >
            <X class="h-3 w-3" />
          </button>
        {/if}
      </button>
    {/each}
    <Button variant="ghost" size="icon" class="h-6 w-6 ml-1" onclick={addTab}>
      <Plus class="h-3 w-3" />
    </Button>
  </div>

  <!-- Terminal surfaces -->
  <div class="flex-1 bg-neutral-950">
    {#each tabs as tab (tab.id)}
      <div class={cn("h-full", activeTab === tab.id ? "" : "hidden")}>
        <TerminalSurface />
      </div>
    {/each}
  </div>
</div>
```

## Integration

### Card Description Editor

> **Current implementation:** Card descriptions use Markdown rendering via `MarkdownRenderer` component with a read/edit toggle and Write/Preview tabs in `CardDetail.svelte`. See `specs/cards.md` for details.

#### Planned: TipTap Upgrade

Replace the Markdown textarea with `RichTextEditor` for full WYSIWYG editing:

```svelte
<!-- In src/lib/components/card/CardDetail.svelte (Planned) -->
<script lang="ts">
  import RichTextEditor from "$lib/components/editor/RichTextEditor.svelte";
  import RichTextContent from "$lib/components/editor/RichTextContent.svelte";
  // ... existing imports

  let editing = $state(false);
  let descriptionHtml = $state(card.description ?? "");
</script>

{#if editing}
  <RichTextEditor
    content={descriptionHtml}
    onUpdate={(html) => (descriptionHtml = html)}
    placeholder="Add a description..."
  />
{:else}
  <button type="button" class="w-full text-left" onclick={() => (editing = true)}>
    {#if descriptionHtml}
      <RichTextContent content={descriptionHtml} />
    {:else}
      <p class="text-sm text-neutral-400">Add a description...</p>
    {/if}
  </button>
{/if}
```

### Comment Rich Text (Planned)

The `CommentList` component (see `specs/comments.md`) can use `RichTextEditor` for composing comments and `RichTextContent` for rendering them, replacing the plain `<textarea>` and `{comment.content}` text display.

## File Locations

| File/Directory | Purpose |
| --- | --- |
| `src/lib/components/markdown/MarkdownRenderer.svelte` | Markdown renderer (marked + DOMPurify) — **Implemented** |
| `src/lib/components/editor/RichTextEditor.svelte` | TipTap WYSIWYG editor with toolbar — **(Planned)** |
| `src/lib/components/editor/RichTextContent.svelte` | Read-only rich text HTML renderer — **(Planned)** |
| `src/lib/components/diff/DiffViewer.svelte` | Unified/split diff rendering with diff2html |
| `src/lib/components/diff/DiffViewToggle.svelte` | Segmented control for diff view mode |
| `src/lib/components/logs/LogViewer.svelte` | Virtualized log viewer with ANSI support |
| `src/lib/components/preview/PreviewPanel.svelte` | Iframe preview panel for dev server output |
| `src/lib/components/terminal/TerminalSurface.svelte` | Xterm.js terminal emulator wrapper |
| `src/lib/components/terminal/TerminalTabs.svelte` | Multi-tab terminal manager |
| `src/lib/components/card/CardDetail.svelte` | Uses MarkdownRenderer for card descriptions (Planned: upgrade to RichTextEditor) |
