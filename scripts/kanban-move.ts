/**
 * Move a kanban task between columns, automatically fixing the ID prefix.
 *
 * Convention: B=backlog, T=todo, P=progress, R=review, D=done
 *
 * Usage:
 *   deno run -A scripts/kanban-move.ts <task-id> <target-column> [--dry-run]
 *   deno run -A scripts/kanban-move.ts T-15 progress
 *   deno run -A scripts/kanban-move.ts B-7 todo --dry-run
 *
 * Column aliases: progress | ip | wip → in_progress
 */

import { parse } from "jsr:@std/yaml";

// ── Constants ──────────────────────────────────────────────────────

const COLUMNS = ["backlog", "todo", "in_progress", "review", "done", "archive"] as const;
type Column = (typeof COLUMNS)[number];

const COLUMN_PREFIX: Record<string, string> = {
  backlog: "B",
  todo: "T",
  in_progress: "P",
  review: "R",
  done: "D",
};

const COLUMN_ALIASES: Record<string, Column> = {
  progress: "in_progress",
  ip: "in_progress",
  wip: "in_progress",
};

interface Task {
  id: string;
  title?: string;
  [key: string]: unknown;
}

interface Kanban {
  [key: string]: unknown;
}

// ── Parse arguments ────────────────────────────────────────────────

const positional = Deno.args.filter((a) => !a.startsWith("--"));
const dryRun = Deno.args.includes("--dry-run");
const taskId = positional[0];
const rawTarget = positional[1];

if (!taskId || !rawTarget) {
  console.error(
    "Usage: deno run -A scripts/kanban-move.ts <task-id> <target-column> [--dry-run]"
  );
  console.error("Columns: backlog, todo, progress|in_progress, review, done");
  Deno.exit(1);
}

const targetColumn: Column =
  (COLUMN_ALIASES[rawTarget] as Column) ?? (rawTarget as Column);

if (!COLUMNS.includes(targetColumn)) {
  console.error(
    `Unknown column: "${rawTarget}". Valid: ${COLUMNS.filter((c) => c !== "archive").join(", ")}`
  );
  Deno.exit(1);
}

// ── Read and parse ─────────────────────────────────────────────────

const filePath = new URL("../kanban.yaml", import.meta.url).pathname;
const raw = await Deno.readTextFile(filePath);
const board = parse(raw) as Kanban;

// Find task in all columns
let sourceColumn: Column | null = null;
for (const col of COLUMNS) {
  const tasks = board[col] as Task[] | undefined;
  if (!tasks?.length) continue;
  if (tasks.find((t) => t.id === taskId)) {
    sourceColumn = col;
    break;
  }
}

if (!sourceColumn) {
  console.error(`Task "${taskId}" not found in any column.`);
  Deno.exit(1);
}

if (sourceColumn === targetColumn) {
  console.log(`Task ${taskId} is already in ${targetColumn}. Nothing to do.`);
  Deno.exit(0);
}

// ── Compute new ID ─────────────────────────────────────────────────

const prefix = COLUMN_PREFIX[targetColumn];
const targetTasks =
  (board[targetColumn] as Task[] | undefined) ?? [];
let maxNum = 0;
for (const t of targetTasks) {
  if (t.id.startsWith(`${prefix}-`)) {
    const n = parseInt(t.id.slice(prefix.length + 1), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }
}
// Also check ALL columns for this prefix to avoid ID collisions with done/archive
for (const col of COLUMNS) {
  const tasks = board[col] as Task[] | undefined;
  if (!tasks?.length) continue;
  for (const t of tasks) {
    if (t.id.startsWith(`${prefix}-`)) {
      const n = parseInt(t.id.slice(prefix.length + 1), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
}
const newId = `${prefix}-${maxNum + 1}`;

// ── Find task block in raw text ────────────────────────────────────

const lines = raw.split("\n");

// Find task start: "  - id: {taskId}"
const escapedId = taskId.replace("-", "\\-");
const taskStartIdx = lines.findIndex((l) =>
  new RegExp(`^\\s+-\\s+id:\\s+${escapedId}\\s*$`).test(l)
);

if (taskStartIdx === -1) {
  console.error(`Could not locate task block for "${taskId}" in raw YAML.`);
  Deno.exit(1);
}

// Find task end: next "  - id:" at same indent OR next top-level column key
let taskEndIdx = lines.length;
for (let i = taskStartIdx + 1; i < lines.length; i++) {
  if (/^\s+-\s+id:\s/.test(lines[i]) || /^[a-z_]+:\s*/.test(lines[i])) {
    taskEndIdx = i;
    break;
  }
}

// Trim trailing blank lines from block end
let blockEnd = taskEndIdx;
while (blockEnd > taskStartIdx + 1 && lines[blockEnd - 1].trim() === "") {
  blockEnd--;
}

// Extract the task block lines
const taskBlock = lines.slice(taskStartIdx, blockEnd);

// ── Find target column boundaries ──────────────────────────────────

// Step 1: Remove task block (and trailing blanks) from source
const removeCount = taskEndIdx - taskStartIdx;
const modified = [...lines];
modified.splice(taskStartIdx, removeCount);

// Clean up extra consecutive blank lines left at removal site
while (
  taskStartIdx < modified.length &&
  taskStartIdx > 0 &&
  modified[taskStartIdx]?.trim() === "" &&
  modified[taskStartIdx - 1]?.trim() === ""
) {
  modified.splice(taskStartIdx, 1);
}

// Step 2: Find target column key line in modified array
const targetKeyIdx = modified.findIndex((l) =>
  new RegExp(`^${targetColumn}:`).test(l)
);

if (targetKeyIdx === -1) {
  console.error(`Could not find "${targetColumn}:" key in kanban.yaml.`);
  Deno.exit(1);
}

// Find where the next top-level key starts after target column
let nextKeyIdx = modified.length;
for (let i = targetKeyIdx + 1; i < modified.length; i++) {
  if (/^[a-z_]+:\s*/.test(modified[i])) {
    nextKeyIdx = i;
    break;
  }
}

// Find insertion point: just after the last non-blank line in the target column
let insertAt = nextKeyIdx;
while (insertAt > targetKeyIdx + 1 && modified[insertAt - 1].trim() === "") {
  insertAt--;
}

// Step 3: Fix the ID in the task block
taskBlock[0] = taskBlock[0].replace(
  new RegExp(`id:\\s+${escapedId}`),
  `id: ${newId}`
);

// Step 4: Add timestamps based on target column
const today = new Date().toISOString().slice(0, 10);

if (targetColumn === "in_progress") {
  // Add "started:" if not already present
  const hasStarted = taskBlock.some((l) => /^\s+started:/.test(l));
  if (!hasStarted) {
    // Insert after the id line
    const indent = "    ";
    taskBlock.splice(1, 0, `${indent}started: ${today}`);
  }
}

if (targetColumn === "done") {
  // Add "completed:" if not already present
  const hasCompleted = taskBlock.some((l) => /^\s+completed:/.test(l));
  if (!hasCompleted) {
    const indent = "    ";
    taskBlock.splice(1, 0, `${indent}completed: ${today}`);
  }
}

// Step 5: Insert task block with spacing
const insertion = ["", ...taskBlock, ""];
modified.splice(insertAt, 0, ...insertion);

// Step 6: Update the "updated:" date at the top
for (let i = 0; i < Math.min(20, modified.length); i++) {
  if (/^updated:/.test(modified[i])) {
    modified[i] = `updated: ${today}`;
    break;
  }
}

// ── Output ─────────────────────────────────────────────────────────

const taskTitle =
  (board[sourceColumn] as Task[])?.find((t) => t.id === taskId)?.title ??
  "(untitled)";

console.log(`\nMove: ${taskId} → ${newId}`);
console.log(`From: ${sourceColumn}`);
console.log(`  To: ${targetColumn}`);
console.log(`Task: ${taskTitle}`);

if (dryRun) {
  console.log("\n--dry-run: no changes written.");
  Deno.exit(0);
}

await Deno.writeTextFile(filePath, modified.join("\n"));
console.log(`\nDone — wrote kanban.yaml`);
