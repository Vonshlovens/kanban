#!/usr/bin/env bun

/**
 * Kanban CLI — Query and manage kanban.yaml using Bun's built-in YAML support.
 *
 * Usage: bun scripts/kanban-cli.ts <command> [options]
 *
 * Commands:
 *   list     List tasks              [--column <col>] [--tag <tag>] [--priority <p>] [--json]
 *   get      Get task details        get <id> [--json]
 *   search   Search tasks            search <query> [--json]
 *   next-id  Next available ID       next-id <column>
 *   add      Add task (JSON stdin)   add --column <col> < task.json
 *   stats    Board statistics        [--json]
 */

import { YAML } from "bun";

// ── Types ────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  tags?: string[];
  assignee?: string;
  created?: string;
  due?: string;
  started?: string;
  completed?: string;
  subtasks?: { text: string; done: boolean }[];
  links?: string[];
  notes?: string;
  commit?: string;
  [key: string]: unknown;
}

interface Board {
  project: string;
  updated: string;
  tags: Record<string, string>;
  backlog: Task[];
  todo: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
  archive: Task[];
}

// ── Constants ────────────────────────────────────────────────────

const COLUMNS = ["backlog", "todo", "in_progress", "review", "done"] as const;
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

const KANBAN_PATH = new URL("../kanban.yaml", import.meta.url).pathname;

// ── Helpers ──────────────────────────────────────────────────────

function resolveColumn(raw: string): Column {
  const alias = COLUMN_ALIASES[raw];
  if (alias) return alias;
  if ((COLUMNS as readonly string[]).includes(raw)) return raw as Column;
  throw new Error(
    `Unknown column: "${raw}". Valid: ${COLUMNS.join(", ")} (aliases: progress, ip, wip)`
  );
}

function readBoard(): { board: Board; raw: string } {
  const raw = Bun.file(KANBAN_PATH).text();
  // Bun.file().text() is async, use readFileSync for simplicity
  const text = require("fs").readFileSync(KANBAN_PATH, "utf-8") as string;
  const board = YAML.parse(text) as Board;
  // Normalize null/undefined columns to empty arrays
  for (const col of [...COLUMNS, "archive"] as const) {
    if (!Array.isArray(board[col])) (board as any)[col] = [];
  }
  return { board, raw: text };
}

function allTasks(board: Board): { task: Task; column: string }[] {
  const result: { task: Task; column: string }[] = [];
  for (const col of COLUMNS) {
    for (const task of board[col] ?? []) {
      result.push({ task, column: col });
    }
  }
  return result;
}

function nextId(board: Board, column: Column): string {
  const prefix = COLUMN_PREFIX[column];
  let maxNum = 0;
  // Check ALL columns to avoid ID collisions
  for (const col of [...COLUMNS, "archive"] as const) {
    for (const t of board[col] ?? []) {
      if (t.id?.startsWith(`${prefix}-`)) {
        const n = parseInt(t.id.slice(prefix.length + 1), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function formatTask(task: Task, column: string, verbose = false): string {
  const status = `[${column}]`.padEnd(14);
  const prio = (task.priority ?? "medium").padEnd(8);
  const tags = task.tags?.join(", ") ?? "";
  const base = `${task.id.padEnd(6)} ${status} ${prio} ${task.title}`;
  if (!verbose) return base;

  const lines = [base];
  if (tags) lines.push(`       Tags: ${tags}`);
  if (task.assignee) lines.push(`       Assignee: ${task.assignee}`);
  if (task.created) lines.push(`       Created: ${task.created}`);
  if (task.due) lines.push(`       Due: ${task.due}`);
  if (task.description) {
    const desc = task.description.trim().split("\n").slice(0, 3).join("\n       ");
    lines.push(`       ${desc}`);
  }
  if (task.subtasks?.length) {
    const done = task.subtasks.filter((s) => s.done).length;
    lines.push(`       Subtasks: ${done}/${task.subtasks.length} done`);
  }
  if (task.links?.length) {
    lines.push(`       Links: ${task.links.join(", ")}`);
  }
  return lines.join("\n");
}

// ── YAML Text Generation ─────────────────────────────────────────

function escapeYamlString(s: string): string {
  // If string contains special chars, quote it
  if (/[:#\[\]{}&*!|>'"`,@%]/.test(s) || s.startsWith("- ") || s === "") {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function taskToYaml(task: Task): string {
  const indent = "    "; // 4 spaces for task fields
  const lines: string[] = [];

  lines.push(`  - id: ${task.id}`);
  lines.push(`${indent}title: ${escapeYamlString(task.title)}`);

  if (task.description) {
    lines.push(`${indent}description: |`);
    for (const line of task.description.trimEnd().split("\n")) {
      lines.push(line === "" ? "" : `${indent}  ${line}`);
    }
  }

  lines.push(`${indent}priority: ${task.priority ?? "medium"}`);

  if (task.tags?.length) {
    lines.push(`${indent}tags: [${task.tags.join(", ")}]`);
  }

  if (task.assignee !== undefined) {
    lines.push(`${indent}assignee: ${escapeYamlString(task.assignee)}`);
  }

  lines.push(`${indent}created: ${task.created ?? new Date().toISOString().slice(0, 10)}`);

  if (task.due) {
    lines.push(`${indent}due: ${task.due}`);
  }

  if (task.subtasks?.length) {
    lines.push(`${indent}subtasks:`);
    for (const s of task.subtasks) {
      lines.push(`${indent}  - text: ${escapeYamlString(s.text)}`);
      lines.push(`${indent}    done: ${s.done ? "true" : "false"}`);
    }
  }

  if (task.links?.length) {
    lines.push(`${indent}links:`);
    for (const link of task.links) {
      lines.push(`${indent}  - ${link}`);
    }
  }

  if (task.notes) {
    lines.push(`${indent}notes: |`);
    for (const line of task.notes.trimEnd().split("\n")) {
      lines.push(line === "" ? "" : `${indent}  ${line}`);
    }
  }

  return lines.join("\n");
}

function insertTaskIntoRaw(raw: string, column: Column, taskYaml: string): string {
  const lines = raw.split("\n");
  const today = new Date().toISOString().slice(0, 10);

  // Update the "updated:" date
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (/^updated:/.test(lines[i])) {
      lines[i] = `updated: ${today}`;
      break;
    }
  }

  // Find target column key line
  const colKeyIdx = lines.findIndex((l) => new RegExp(`^${column}:`).test(l));
  if (colKeyIdx === -1) {
    throw new Error(`Could not find "${column}:" key in kanban.yaml`);
  }

  // Find next top-level key after this column
  let nextKeyIdx = lines.length;
  for (let i = colKeyIdx + 1; i < lines.length; i++) {
    if (/^[a-z_]+:\s*/.test(lines[i])) {
      nextKeyIdx = i;
      break;
    }
  }

  // Find insertion point: just before trailing blank lines of the column
  let insertAt = nextKeyIdx;
  while (insertAt > colKeyIdx + 1 && lines[insertAt - 1].trim() === "") {
    insertAt--;
  }

  // Insert with spacing
  const insertion = ["", taskYaml, ""];
  lines.splice(insertAt, 0, ...insertion);

  return lines.join("\n");
}

// ── Commands ─────────────────────────────────────────────────────

function cmdList(args: string[]) {
  const { board } = readBoard();
  const json = hasFlag(args, "--json");
  const colFilter = parseFlag(args, "--column");
  const tagFilter = parseFlag(args, "--tag");
  const prioFilter = parseFlag(args, "--priority");
  const assigneeFilter = parseFlag(args, "--assignee");

  let tasks = allTasks(board);

  if (colFilter) {
    const col = resolveColumn(colFilter);
    tasks = tasks.filter((t) => t.column === col);
  }
  if (tagFilter) {
    tasks = tasks.filter((t) => t.task.tags?.includes(tagFilter));
  }
  if (prioFilter) {
    tasks = tasks.filter((t) => t.task.priority === prioFilter);
  }
  if (assigneeFilter) {
    tasks = tasks.filter((t) => t.task.assignee === assigneeFilter);
  }

  if (json) {
    console.log(JSON.stringify(tasks.map((t) => ({ ...t.task, _column: t.column })), null, 2));
    return;
  }

  if (tasks.length === 0) {
    console.log("No tasks found.");
    return;
  }

  // Group by column
  const grouped = new Map<string, { task: Task; column: string }[]>();
  for (const t of tasks) {
    const list = grouped.get(t.column) ?? [];
    list.push(t);
    grouped.set(t.column, list);
  }

  for (const col of COLUMNS) {
    const list = grouped.get(col);
    if (!list?.length) continue;
    console.log(`\n── ${col} (${list.length}) ──`);
    for (const { task, column } of list) {
      const prio = (task.priority ?? "medium").padEnd(8);
      const tags = task.tags?.length ? ` [${task.tags.join(", ")}]` : "";
      console.log(`  ${task.id.padEnd(6)} ${prio} ${task.title}${tags}`);
    }
  }
  console.log(`\nTotal: ${tasks.length} tasks`);
}

function cmdGet(args: string[]) {
  const id = args.find((a) => !a.startsWith("--"));
  if (!id) {
    console.error("Usage: bun scripts/kanban-cli.ts get <task-id>");
    process.exit(1);
  }

  const { board } = readBoard();
  const json = hasFlag(args, "--json");

  for (const col of COLUMNS) {
    const task = board[col]?.find((t) => t.id === id);
    if (task) {
      if (json) {
        console.log(JSON.stringify({ ...task, _column: col }, null, 2));
      } else {
        console.log(formatTask(task, col, true));
        if (task.description) {
          console.log(`\n--- Description ---\n${task.description.trim()}`);
        }
        if (task.subtasks?.length) {
          console.log("\n--- Subtasks ---");
          for (const s of task.subtasks) {
            console.log(`  ${s.done ? "[x]" : "[ ]"} ${s.text}`);
          }
        }
      }
      return;
    }
  }

  // Also check archive
  const archiveTask = board.archive?.find((t) => t.id === id);
  if (archiveTask) {
    if (json) {
      console.log(JSON.stringify({ ...archiveTask, _column: "archive" }, null, 2));
    } else {
      console.log(formatTask(archiveTask, "archive", true));
    }
    return;
  }

  console.error(`Task "${id}" not found.`);
  process.exit(1);
}

function cmdSearch(args: string[]) {
  const query = args.filter((a) => !a.startsWith("--")).join(" ").toLowerCase();
  if (!query) {
    console.error("Usage: bun scripts/kanban-cli.ts search <query>");
    process.exit(1);
  }

  const { board } = readBoard();
  const json = hasFlag(args, "--json");

  const matches = allTasks(board).filter(({ task }) => {
    const haystack = [task.title, task.description, ...(task.tags ?? [])].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  if (json) {
    console.log(
      JSON.stringify(
        matches.map((t) => ({ ...t.task, _column: t.column })),
        null,
        2
      )
    );
    return;
  }

  if (matches.length === 0) {
    console.log(`No tasks matching "${query}".`);
    return;
  }

  console.log(`Found ${matches.length} task(s) matching "${query}":\n`);
  for (const { task, column } of matches) {
    console.log(formatTask(task, column));
  }
}

function cmdNextId(args: string[]) {
  const colName = args.find((a) => !a.startsWith("--"));
  if (!colName) {
    console.error("Usage: bun scripts/kanban-cli.ts next-id <column>");
    process.exit(1);
  }

  const { board } = readBoard();
  const column = resolveColumn(colName);
  const id = nextId(board, column);

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify({ column, nextId: id }));
  } else {
    console.log(id);
  }
}

async function cmdAdd(args: string[]) {
  const colName = parseFlag(args, "--column");
  if (!colName) {
    console.error("Usage: bun scripts/kanban-cli.ts add --column <col> < task.json");
    console.error("       echo '{...}' | bun scripts/kanban-cli.ts add --column <col>");
    console.error("\nAlternatively, use flags:");
    console.error("  --title, --description, --priority, --tags (comma-sep), --links (comma-sep), --subtasks (pipe-sep)");
    process.exit(1);
  }

  const column = resolveColumn(colName);
  const json = hasFlag(args, "--json");
  const dryRun = hasFlag(args, "--dry-run");
  const { board, raw } = readBoard();
  const id = nextId(board, column);
  const today = new Date().toISOString().slice(0, 10);

  let taskData: Partial<Task>;

  // Check if stdin has data (piped JSON)
  const stdinData = await readStdin();
  if (stdinData) {
    try {
      taskData = JSON.parse(stdinData);
    } catch {
      console.error("Failed to parse JSON from stdin.");
      process.exit(1);
    }

    // Normalize subtasks: accept both string[] and {text, done}[]
    if (Array.isArray(taskData.subtasks)) {
      taskData.subtasks = taskData.subtasks.map((s: unknown) =>
        typeof s === "string" ? { text: s, done: false } : (s as { text: string; done: boolean })
      );
    }
  } else {
    // Build from flags
    const title = parseFlag(args, "--title");
    if (!title) {
      console.error("Error: --title is required (or pipe JSON to stdin).");
      process.exit(1);
    }
    taskData = {
      title,
      description: parseFlag(args, "--description"),
      priority: parseFlag(args, "--priority") ?? "medium",
      tags: parseFlag(args, "--tags")?.split(",").map((t) => t.trim()),
      links: parseFlag(args, "--links")?.split(",").map((l) => l.trim()),
    };

    const subtasksRaw = parseFlag(args, "--subtasks");
    if (subtasksRaw) {
      taskData.subtasks = subtasksRaw.split("|").map((text) => ({ text: text.trim(), done: false }));
    }
  }

  const task: Task = {
    id,
    title: taskData.title ?? "Untitled",
    description: taskData.description,
    priority: taskData.priority ?? "medium",
    tags: taskData.tags,
    assignee: taskData.assignee ?? "",
    created: taskData.created ?? today,
    due: taskData.due,
    subtasks: taskData.subtasks,
    links: taskData.links,
    notes: taskData.notes,
  };

  const yamlBlock = taskToYaml(task);
  const updatedRaw = insertTaskIntoRaw(raw, column, yamlBlock);

  if (dryRun) {
    console.log("--- Dry run: would insert ---");
    console.log(yamlBlock);
    console.log(`\nColumn: ${column}`);
    console.log(`ID: ${id}`);
    return;
  }

  require("fs").writeFileSync(KANBAN_PATH, updatedRaw);

  if (json) {
    console.log(JSON.stringify({ id, column, title: task.title }));
  } else {
    console.log(`Added ${id}: ${task.title}`);
    console.log(`Column: ${column}`);
  }
}

function cmdStats(args: string[]) {
  const { board } = readBoard();
  const json = hasFlag(args, "--json");

  const stats: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const prioCounts: Record<string, number> = {};
  let total = 0;

  for (const col of COLUMNS) {
    const tasks = board[col] ?? [];
    stats[col] = tasks.length;
    total += tasks.length;
    for (const t of tasks) {
      for (const tag of t.tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      const prio = t.priority ?? "medium";
      prioCounts[prio] = (prioCounts[prio] ?? 0) + 1;
    }
  }

  if (json) {
    console.log(JSON.stringify({ total, columns: stats, tags: tagCounts, priorities: prioCounts }, null, 2));
    return;
  }

  console.log("── Kanban Stats ──\n");
  console.log(`Total: ${total} tasks\n`);
  console.log("By column:");
  for (const col of COLUMNS) {
    const bar = "█".repeat(Math.min(stats[col], 30));
    console.log(`  ${col.padEnd(14)} ${String(stats[col]).padStart(3)}  ${bar}`);
  }

  console.log("\nBy priority:");
  for (const p of ["critical", "high", "medium", "low"]) {
    if (prioCounts[p]) {
      console.log(`  ${p.padEnd(10)} ${String(prioCounts[p]).padStart(3)}`);
    }
  }

  console.log("\nBy tag:");
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sortedTags) {
    console.log(`  ${tag.padEnd(12)} ${String(count).padStart(3)}`);
  }
}

// ── Stdin helper ─────────────────────────────────────────────────

async function readStdin(): Promise<string | null> {
  // Check if stdin is a TTY (interactive) — if so, no piped data
  if (process.stdin.isTTY) return null;

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf-8").trim();
  return text || null;
}

// ── Main ─────────────────────────────────────────────────────────

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "list":
  case "ls":
    cmdList(rest);
    break;
  case "get":
    cmdGet(rest);
    break;
  case "search":
  case "find":
    cmdSearch(rest);
    break;
  case "next-id":
  case "nextid":
    cmdNextId(rest);
    break;
  case "add":
  case "create":
    await cmdAdd(rest);
    break;
  case "stats":
    cmdStats(rest);
    break;
  default:
    console.log(`Kanban CLI — Manage kanban.yaml with Bun

Usage: bun scripts/kanban-cli.ts <command> [options]

Commands:
  list     List tasks              [--column <col>] [--tag <tag>] [--priority <p>] [--json]
  get      Get task by ID          get <id> [--json]
  search   Search by text          search <query> [--json]
  next-id  Next available ID       next-id <column>
  add      Add a task              add --column <col> --title "..." [options]
  stats    Board statistics        [--json]

Add from JSON (recommended for complex tasks):
  echo '{"title":"...","description":"...","priority":"high","tags":["frontend"],"subtasks":["Step 1","Step 2"],"links":["specs/foo.md"]}' \\
    | bun scripts/kanban-cli.ts add --column backlog

Add from flags (quick tasks):
  bun scripts/kanban-cli.ts add --column todo --title "Fix bug" --priority high --tags "bug,frontend"

Column aliases: progress | ip | wip → in_progress`);
    if (command && command !== "help" && command !== "--help" && command !== "-h") {
      console.error(`\nUnknown command: "${command}"`);
      process.exit(1);
    }
    break;
}
