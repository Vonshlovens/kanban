import { db } from "$lib/db";
import { boards } from "$lib/db/schema";
import { asc } from "drizzle-orm";
import type { LayoutServerLoad } from "./$types";
import type { SidebarBoard } from "$lib/types";

export const load: LayoutServerLoad = async () => {
  const allBoards: SidebarBoard[] = await db
    .select({
      id: boards.id,
      name: boards.name,
      isFavorite: boards.isFavorite,
    })
    .from(boards)
    .orderBy(asc(boards.name));

  return { boards: allBoards };
};
