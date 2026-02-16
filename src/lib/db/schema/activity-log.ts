import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cards } from "./cards";
import { boards } from "./boards";
import { users } from "./users";

export const activityLog = pgTable("activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").references(() => cards.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<ActivityMetadata>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityAction =
  | "card.created"
  | "card.moved"
  | "card.updated"
  | "card.deleted"
  | "comment.added";

export type ActivityMetadata =
  | { fromColumn: string; toColumn: string }
  | { field: string; oldValue: string | null; newValue: string | null }
  | { commentPreview: string }
  | Record<string, never>;

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  board: one(boards, {
    fields: [activityLog.boardId],
    references: [boards.id],
  }),
  card: one(cards, { fields: [activityLog.cardId], references: [cards.id] }),
  user: one(users, { fields: [activityLog.userId], references: [users.id] }),
}));
