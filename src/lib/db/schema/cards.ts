import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { columns } from "./columns";
import { users } from "./users";
import { cardLabels } from "./card-labels";
import { comments } from "./comments";
import { activityLog } from "./activity-log";

export const cards = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  columnId: uuid("column_id")
    .notNull()
    .references(() => columns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cardsRelations = relations(cards, ({ one, many }) => ({
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  assignee: one(users, { fields: [cards.assigneeId], references: [users.id] }),
  cardLabels: many(cardLabels),
  comments: many(comments),
  activityLog: many(activityLog),
}));
