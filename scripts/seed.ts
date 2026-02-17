/**
 * Database seed script — populates the database with sample data for local development.
 *
 * Creates a demo board with columns, cards, labels, comments, and a test user.
 * Safe to run multiple times: truncates all tables before inserting.
 *
 * Usage: deno task db:seed
 *    or: deno run -A scripts/seed.ts
 *
 * Requires DATABASE_URL environment variable.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema/index.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error("Example: DATABASE_URL=postgresql://kanban:kanban@localhost:5432/kanban");
  Deno.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...\n");

  // Truncate all tables (cascade to handle foreign keys)
  console.log("Clearing existing data...");
  await db.execute(sql`
    TRUNCATE TABLE activity_log, card_labels, comments, cards, labels, columns, boards, users
    CASCADE
  `);

  // --- Users ---
  console.log("Creating users...");
  const [alice, bob, carol] = await db
    .insert(schema.users)
    .values([
      { name: "Alice Chen", email: "alice@example.com", avatarUrl: null },
      { name: "Bob Martinez", email: "bob@example.com", avatarUrl: null },
      { name: "Carol Kim", email: "carol@example.com", avatarUrl: null },
    ])
    .returning();

  // --- Board ---
  console.log("Creating board...");
  const [board] = await db
    .insert(schema.boards)
    .values({
      name: "Project Alpha",
      description: "A demo kanban board with sample tasks for local development.",
      isFavorite: true,
    })
    .returning();

  // --- Columns ---
  console.log("Creating columns...");
  const [colBacklog, colTodo, colInProgress, colReview, colDone] = await db
    .insert(schema.columns)
    .values([
      { boardId: board.id, name: "Backlog", position: 0 },
      { boardId: board.id, name: "To Do", position: 1 },
      { boardId: board.id, name: "In Progress", position: 2, wipLimit: 3 },
      { boardId: board.id, name: "Review", position: 3, wipLimit: 2 },
      { boardId: board.id, name: "Done", position: 4 },
    ])
    .returning();

  // --- Labels ---
  console.log("Creating labels...");
  const [lblBug, lblFeature, lblUrgent, lblDesign, lblDocs] = await db
    .insert(schema.labels)
    .values([
      { boardId: board.id, name: "Bug", color: "#ef4444" },
      { boardId: board.id, name: "Feature", color: "#3b82f6" },
      { boardId: board.id, name: "Urgent", color: "#f97316" },
      { boardId: board.id, name: "Design", color: "#a855f7" },
      { boardId: board.id, name: "Docs", color: "#22c55e" },
    ])
    .returning();

  // --- Cards ---
  console.log("Creating cards...");

  // Backlog cards
  const [cardResearch, cardA11y] = await db
    .insert(schema.cards)
    .values([
      {
        columnId: colBacklog.id,
        title: "Research WebSocket integration",
        description:
          "Evaluate options for real-time updates:\n\n- Socket.IO\n- Native WebSocket with SvelteKit\n- Server-Sent Events\n\nConsider complexity, bundle size, and reconnection handling.",
        position: 0,
      },
      {
        columnId: colBacklog.id,
        title: "Accessibility audit",
        description:
          "Run **axe-core** and **Lighthouse** audits on all pages. Document and fix:\n\n1. Missing ARIA labels\n2. Color contrast issues\n3. Keyboard navigation gaps",
        position: 1,
      },
    ])
    .returning();

  // To Do cards
  const [cardAuth, cardSearch] = await db
    .insert(schema.cards)
    .values([
      {
        columnId: colTodo.id,
        title: "Set up user authentication",
        description:
          "Implement authentication flow with session-based auth.\n\n## Requirements\n- Login / register pages\n- Session cookies\n- Protected routes middleware\n- Logout endpoint",
        position: 0,
        assigneeId: alice.id,
        dueDate: futureDate(14),
      },
      {
        columnId: colTodo.id,
        title: "Add card search and filtering",
        description:
          "Add a search bar to the board page that filters cards by:\n- Title (substring match)\n- Label\n- Assignee\n- Due date range",
        position: 1,
        dueDate: futureDate(7),
      },
    ])
    .returning();

  // In Progress cards
  const [cardDrag, cardDark] = await db
    .insert(schema.cards)
    .values([
      {
        columnId: colInProgress.id,
        title: "Fix drag-and-drop reorder bug",
        description:
          "Cards sometimes jump to the wrong position after drag-and-drop when the column has more than 5 cards. The `position` field is not being recalculated correctly.\n\n**Steps to reproduce:**\n1. Add 6+ cards to a column\n2. Drag card #3 to position #5\n3. Observe card lands at position #6 instead",
        position: 0,
        assigneeId: bob.id,
        dueDate: futureDate(3),
      },
      {
        columnId: colInProgress.id,
        title: "Implement dark mode toggle",
        description: "Wire up the `mode-watcher` theme toggle in the navbar. Use `mode.current` (not `$mode`) for Svelte 5 runes mode compatibility.",
        position: 1,
        assigneeId: carol.id,
      },
    ])
    .returning();

  // Review cards
  const [cardApi] = await db
    .insert(schema.cards)
    .values([
      {
        columnId: colReview.id,
        title: "REST API documentation",
        description:
          "Document all server endpoints with:\n- Method & path\n- Request/response types\n- Error codes\n- Example `curl` commands",
        position: 0,
        assigneeId: alice.id,
      },
    ])
    .returning();

  // Done cards
  const [cardSetup, cardSchema] = await db
    .insert(schema.cards)
    .values([
      {
        columnId: colDone.id,
        title: "Initial project setup",
        description: "Scaffold SvelteKit project with Tailwind CSS, shadcn-svelte, and Drizzle ORM.",
        position: 0,
      },
      {
        columnId: colDone.id,
        title: "Design database schema",
        description: "Create Drizzle schema for boards, columns, cards, labels, comments, and users.",
        position: 1,
        assigneeId: bob.id,
      },
    ])
    .returning();

  // --- Card Labels ---
  console.log("Assigning labels to cards...");
  await db.insert(schema.cardLabels).values([
    { cardId: cardDrag.id, labelId: lblBug.id },
    { cardId: cardDrag.id, labelId: lblUrgent.id },
    { cardId: cardAuth.id, labelId: lblFeature.id },
    { cardId: cardSearch.id, labelId: lblFeature.id },
    { cardId: cardDark.id, labelId: lblFeature.id },
    { cardId: cardApi.id, labelId: lblDocs.id },
    { cardId: cardA11y.id, labelId: lblDesign.id },
    { cardId: cardResearch.id, labelId: lblDocs.id },
    { cardId: cardSetup.id, labelId: lblFeature.id },
    { cardId: cardSchema.id, labelId: lblDesign.id },
  ]);

  // --- Comments ---
  console.log("Adding comments...");
  await db.insert(schema.comments).values([
    {
      cardId: cardDrag.id,
      authorId: bob.id,
      content:
        "I've narrowed it down to the `recalculatePositions` function. The issue is that we're using the array index instead of the target position when there are gaps in the position sequence.",
    },
    {
      cardId: cardDrag.id,
      authorId: alice.id,
      content:
        "Good find! We should also add a test case for this. Can you write a unit test that reproduces the gap scenario?",
    },
    {
      cardId: cardAuth.id,
      authorId: carol.id,
      content: "Should we use **JWT** or **session cookies** for this? I'd lean toward cookies for SSR compatibility.",
    },
    {
      cardId: cardAuth.id,
      authorId: alice.id,
      content: "Agreed — session cookies work better with SvelteKit's server-side rendering. Let's go with that approach.",
    },
    {
      cardId: cardApi.id,
      authorId: alice.id,
      content: "I've documented the board and column endpoints. Cards and comments are still TODO.",
    },
  ]);

  // --- Activity Log ---
  console.log("Adding activity log entries...");
  await db.insert(schema.activityLog).values([
    {
      boardId: board.id,
      cardId: cardSetup.id,
      userId: alice.id,
      action: "card.created",
    },
    {
      boardId: board.id,
      cardId: cardSchema.id,
      userId: bob.id,
      action: "card.created",
    },
    {
      boardId: board.id,
      cardId: cardDrag.id,
      userId: bob.id,
      action: "card.moved",
      metadata: { fromColumn: "To Do", toColumn: "In Progress" },
    },
    {
      boardId: board.id,
      cardId: cardApi.id,
      userId: alice.id,
      action: "card.moved",
      metadata: { fromColumn: "In Progress", toColumn: "Review" },
    },
    {
      boardId: board.id,
      cardId: cardDrag.id,
      userId: alice.id,
      action: "comment.added",
      metadata: { commentPreview: "Good find! We should also add a test case..." },
    },
  ]);

  // --- Summary ---
  console.log("\nSeed complete! Created:");
  console.log("  3 users (Alice, Bob, Carol)");
  console.log("  1 board (Project Alpha)");
  console.log("  5 columns (Backlog, To Do, In Progress, Review, Done)");
  console.log("  5 labels (Bug, Feature, Urgent, Design, Docs)");
  console.log("  9 cards across all columns");
  console.log("  10 card-label assignments");
  console.log("  5 comments");
  console.log("  5 activity log entries");
}

/** Returns a Date N days from now (for due dates). */
function futureDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

try {
  await seed();
} catch (err) {
  console.error("Seed failed:", err);
  Deno.exit(1);
} finally {
  await client.end();
}
