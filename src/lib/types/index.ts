import type { boards } from "$lib/db/schema/boards";
import type { columns } from "$lib/db/schema/columns";
import type { cards } from "$lib/db/schema/cards";
import type { labels } from "$lib/db/schema/labels";
import type { cardLabels } from "$lib/db/schema/card-labels";
import type { comments } from "$lib/db/schema/comments";
import type { users } from "$lib/db/schema/users";
import type { activityLog } from "$lib/db/schema/activity-log";

// ---------------------------------------------------------------------------
// Base row types (1:1 with database columns)
// ---------------------------------------------------------------------------

export type Board = typeof boards.$inferSelect;
export type Column = typeof columns.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type CardLabel = typeof cardLabels.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type User = typeof users.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;

// ---------------------------------------------------------------------------
// Page-level view types (used by server load functions & page components)
// ---------------------------------------------------------------------------

/** Board summary for the boards list page — no nested relations. */
export type BoardSummary = Pick<
  Board,
  "id" | "name" | "description" | "isFavorite" | "updatedAt"
>;

/** Minimal board reference used by the sidebar navigation. */
export type SidebarBoard = Pick<Board, "id" | "name" | "isFavorite">;

// ---------------------------------------------------------------------------
// Lightweight "pick" types used across many components
// ---------------------------------------------------------------------------

/** Minimal column reference (e.g. for selects, move dialogs). */
export type ColumnRef = Pick<Column, "id" | "name">;

/** Minimal label with display info, nested inside card-label joins. */
export type LabelRef = Pick<Label, "id" | "name" | "color">;

/** A card-label join carrying its nested label reference. */
export type CardLabelWithLabel = { label: LabelRef };

/** Comment author info. */
export type CommentAuthor = Pick<User, "id" | "name" | "avatarUrl">;

// ---------------------------------------------------------------------------
// Composite view types (matching Drizzle relational query shapes)
// ---------------------------------------------------------------------------

/** Comment as returned with its author relation. */
export type CommentWithAuthor = Pick<
  Comment,
  "id" | "content" | "createdAt" | "updatedAt"
> & {
  author: CommentAuthor;
};

/** Card as shown in the board column list (board page query). */
export type BoardCard = Pick<
  Card,
  "id" | "columnId" | "title" | "description" | "dueDate" | "position"
> & {
  cardLabels?: CardLabelWithLabel[];
  comments?: { id: string }[];
};

/** Full card detail (card detail page query). */
export type CardDetail = Pick<
  Card,
  | "id"
  | "title"
  | "description"
  | "dueDate"
  | "position"
  | "createdAt"
  | "updatedAt"
> & {
  column: ColumnRef;
  cardLabels: CardLabelWithLabel[];
  comments: CommentWithAuthor[];
};

/** Column with its nested cards, as returned in the board page query. */
export type BoardColumn = Pick<
  Column,
  "id" | "boardId" | "name" | "position" | "wipLimit"
> & {
  cards: BoardCard[];
};

/** Board with its nested columns, as returned in the board page query. */
export type BoardWithColumns = Pick<
  Board,
  "id" | "name" | "description" | "isFavorite" | "createdAt" | "updatedAt"
> & {
  columns: BoardColumn[];
  labels: LabelRef[];
};
