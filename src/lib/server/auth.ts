import { db } from "$lib/db";
import { users } from "$lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_USER_EMAIL = "default@kanban.local";

/**
 * Gets or creates a default user for single-user mode.
 * Replace with real auth when implementing user authentication.
 */
export async function getDefaultUser() {
  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, DEFAULT_USER_EMAIL),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      name: "You",
      email: DEFAULT_USER_EMAIL,
    })
    .returning();

  return created;
}
