import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { columns } from "./columns";
import { labels } from "./labels";
import { activityLog } from "./activity-log";

export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const boardsRelations = relations(boards, ({ many }) => ({
  columns: many(columns),
  labels: many(labels),
  activityLog: many(activityLog),
}));
