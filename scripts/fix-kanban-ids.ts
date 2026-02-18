/**
 * Fix kanban.yaml task ID prefixes to match their column.
 *
 * Convention: B=backlog, T=todo, P=progress, R=review, D=done
 *
 * Usage: deno run -A scripts/fix-kanban-ids.ts [--dry-run]
 */

import { parse, stringify } from "jsr:@std/yaml";

const COLUMN_PREFIX: Record<string, string> = {
  backlog: "B",
  todo: "T",
  in_progress: "P",
  review: "R",
  done: "D",
};

interface Task {
  id: string;
  title?: string;
  [key: string]: unknown;
}

interface Kanban {
  backlog?: Task[];
  todo?: Task[];
  in_progress?: Task[];
  review?: Task[];
  done?: Task[];
  [key: string]: unknown;
}

const dryRun = Deno.args.includes("--dry-run");
const filePath = new URL("../kanban.yaml", import.meta.url).pathname;
const raw = await Deno.readTextFile(filePath);
const board = parse(raw) as Kanban;

const renames: { column: string; oldId: string; newId: string; title: string }[] = [];

for (const [column, prefix] of Object.entries(COLUMN_PREFIX)) {
  const tasks = board[column] as Task[] | undefined;
  if (!tasks?.length) continue;

  // Find highest existing correct-prefix number in this column
  let maxNum = 0;
  for (const t of tasks) {
    if (t.id.startsWith(`${prefix}-`)) {
      const n = parseInt(t.id.slice(prefix.length + 1), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }

  for (const task of tasks) {
    const currentPrefix = task.id.split("-")[0];
    if (currentPrefix === prefix) continue; // already correct

    maxNum++;
    const newId = `${prefix}-${maxNum}`;
    renames.push({
      column,
      oldId: task.id,
      newId,
      title: task.title ?? "(untitled)",
    });
    task.id = newId;
  }
}

if (renames.length === 0) {
  console.log("All task IDs already match their column prefix. Nothing to do.");
  Deno.exit(0);
}

console.log(`Found ${renames.length} ID(s) to fix:\n`);
console.log("Column       | Old ID  → New ID  | Title");
console.log("─────────────┼──────────────────┼────────────────────────────────────");
for (const r of renames) {
  const col = r.column.padEnd(12);
  const ids = `${r.oldId.padEnd(6)} → ${r.newId.padEnd(6)}`;
  console.log(`${col} | ${ids} | ${r.title}`);
}

if (dryRun) {
  console.log("\n--dry-run: no changes written.");
  Deno.exit(0);
}

// Do string replacements on the raw YAML to preserve comments/formatting
let patched = raw;
for (const r of renames) {
  // Replace `id: B-49` with `id: T-14` etc. (exact match on the id value)
  const pattern = new RegExp(`(id:\\s*)${r.oldId.replace("-", "\\-")}\\b`, "g");
  patched = patched.replace(pattern, `$1${r.newId}`);
}

await Deno.writeTextFile(filePath, patched);
console.log(`\nWrote ${renames.length} ID fix(es) to kanban.yaml`);
