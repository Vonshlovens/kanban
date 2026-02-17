import { redirect } from "@sveltejs/kit";
import { db } from "$lib/db";
import { boards } from "$lib/db/schema";
import { desc } from "drizzle-orm";
import type { PageServerLoad } from "./$types";
import type { BoardSummary } from "$lib/types";

export const load: PageServerLoad = async () => {
  const allBoards: BoardSummary[] = await db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      isFavorite: boards.isFavorite,
      updatedAt: boards.updatedAt,
    })
    .from(boards)
    .orderBy(desc(boards.updatedAt));

  if (allBoards.length === 1) {
    throw redirect(303, `/boards/${allBoards[0].id}`);
  }

  return { boards: allBoards };
};
