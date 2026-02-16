import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { cards } from "$lib/db/schema/cards";
import { eq } from "drizzle-orm";
import { reorderCardsSchema } from "$lib/schemas/card";

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const result = reorderCardsSchema.safeParse(body);

  if (!result.success) {
    throw error(400, "Invalid card order");
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < result.data.cardIds.length; i++) {
      await tx
        .update(cards)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(cards.id, result.data.cardIds[i]));
    }
  });

  return json({ ok: true });
};
