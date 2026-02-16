import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { boards } from "./boards";
import { cardLabels } from "./card-labels";

export const labels = pgTable("labels", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const labelsRelations = relations(labels, ({ one, many }) => ({
  board: one(boards, { fields: [labels.boardId], references: [boards.id] }),
  cardLabels: many(cardLabels),
}));
