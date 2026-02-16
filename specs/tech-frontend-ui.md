# Tech Stack: Frontend UI

Component library, styling, and UI primitives for the Kanban application.

## Component Library: shadcn-svelte

shadcn-svelte provides pre-built, customizable UI components built on bits-ui primitives and styled with Tailwind CSS.

**Configuration:** `components.json` at the project root defines:
- Base color theme (Slate)
- Component aliases and paths
- Registry URL: `https://shadcn-svelte.com/registry`

### Key Components

| Component       | Usage                                    |
|-----------------|------------------------------------------|
| `button`        | Primary actions, toolbar buttons         |
| `dialog`        | Card detail modals, confirmations        |
| `alert-dialog`  | Destructive action confirmations         |
| `input`         | Text fields, search bars                 |
| `label`         | Form field labels                        |
| `select`        | Dropdowns (assignee, label picker)       |
| `sheet`         | Slide-over panels                        |
| `table`         | Tabular data views                       |
| `form`          | Form wrapper with validation             |
| `separator`     | Visual dividers                          |
| `tooltip`       | Hover hints                              |
| `skeleton`      | Loading placeholders                     |
| `sonner`        | Toast notifications                      |
| `sidebar`       | Navigation sidebar                       |
| `command`       | Command palette / search                 |
| `collapsible`   | Expandable sections                      |
| `breadcrumb`    | Navigation breadcrumbs                   |
| `switch`        | Toggle switches                          |
| `progress`      | Progress indicators                      |

### No Tabs Component

shadcn-svelte does not include a Tabs component. Use a custom segmented control instead:

```svelte
<div class="flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
  {#each tabs as tab}
    <button
      class={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        activeTab === tab.id
          ? "bg-white shadow-sm dark:bg-neutral-700"
          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
      )}
      onclick={() => activeTab = tab.id}
    >
      {tab.label}
    </button>
  {/each}
</div>
```

## Primitives: bits-ui

bits-ui provides headless, accessible component primitives that shadcn-svelte builds on:

- Dialog, AlertDialog, Sheet (overlays)
- Select, Command (selection)
- Collapsible (disclosure)
- Tooltip (popovers)

Import via shadcn-svelte wrappers, not directly from bits-ui.

## Styling: Tailwind CSS 4

| Package                | Version  | Purpose                  |
|------------------------|----------|--------------------------|
| `tailwindcss`          | ^4.x     | Utility-first CSS        |
| `@tailwindcss/vite`    | ^4.x     | Vite plugin integration  |
| `tailwind-merge`       | ^3.x     | Safe class merging       |
| `tailwind-variants`    | ^3.x     | Variant patterns         |
| `tw-animate-css`       | ^1.x     | Animation utilities      |
| `clsx`                 | ^2.x     | Conditional class names  |

> **Note:** Tailwind CSS 4 uses the Vite plugin (`@tailwindcss/vite`) instead of PostCSS. No `tailwind.config.js` or `@tailwindcss/postcss` is needed.

### Utility Function

`cn()` helper and type utilities in `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
```

### Global Styles

`src/app.css` imports Tailwind and defines CSS custom properties for theming.

## Icons: Lucide Svelte

| Package          | Version  |
|------------------|----------|
| `@lucide/svelte` | ^0.564.x |

560+ icons as Svelte components:

```svelte
<script>
  import { Plus, Trash2, GripVertical } from "@lucide/svelte";
</script>

<Plus class="h-4 w-4" />
```

## Dark Mode: mode-watcher

| Package        | Version |
|----------------|---------|
| `mode-watcher` | ^1.x    |

Detects system preference and allows manual toggle:

```svelte
<script>
  import { ModeWatcher } from "mode-watcher";
</script>

<!-- In root +layout.svelte -->
<ModeWatcher />
```

## Toast Notifications: svelte-sonner

| Package        | Version |
|----------------|---------|
| `svelte-sonner` | ^1.x   |

```svelte
<script>
  import { toast } from "svelte-sonner";

  function handleSave() {
    toast.success("Card saved");
  }
</script>
```

## Forms & Validation

| Package               | Version  | Purpose                    |
|-----------------------|----------|----------------------------|
| `sveltekit-superforms` | ^2.x    | Server-side form handling  |
| `formsnap`            | ^2.x     | Svelte form bindings       |
| `zod`                 | ^4.x     | Schema validation          |

### Form Pattern

```typescript
// +page.server.ts
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { createBoardSchema } from "$lib/schemas/board";

export const load = async () => {
  const form = await superValidate(zod(createBoardSchema));
  return { form };
};

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(createBoardSchema));
    if (!form.valid) return fail(400, { form });
    // ... create board
    return { form };
  },
};
```

```svelte
<!-- +page.svelte -->
<script>
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";

  let { data } = $props();
  const form = superForm(data.form, {
    validators: zodClient(createBoardSchema),
  });
  const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance>
  <input name="name" bind:value={$formData.name} />
  <button type="submit">Create Board</button>
</form>
```

## Animation

`tw-animate-css` provides animation utilities (fade, slide, scale, spin, etc.) via Tailwind classes. Custom keyframes can be added in `src/app.css` when needed for specific interactions (drag-and-drop feedback, card transitions).
