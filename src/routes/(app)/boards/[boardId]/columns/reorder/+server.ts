import type { RequestHandler } from "./$types";
import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { columns } from "$lib/db/schema/columns";
import { eq, and } from "drizzle-orm";
import { reorderColumnsSchema } from "$lib/schemas/column";

export const PUT: RequestHandler = async ({ request, params }) => {
  const body = await request.json();
  const result = reorderColumnsSchema.safeParse(body);

  if (!result.success) {
    throw error(400, "Invalid column order");
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < result.data.columnIds.length; i++) {
      await tx
        .update(columns)
        .set({ position: i, updatedAt: new Date() })
        .where(
          and(
            eq(columns.id, result.data.columnIds[i]),
            eq(columns.boardId, params.boardId),
          ),
        );
    }
  });

  return json({ ok: true });
};
