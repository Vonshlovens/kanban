import type { PageServerLoad, Actions } from "./$types";
import { error, fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { createColumnSchema, renameColumnSchema, deleteColumnSchema } from "$lib/schemas/column";
import { createCardSchema, deleteCardSchema } from "$lib/schemas/card";
import { db } from "$lib/db";
import { columns } from "$lib/db/schema/columns";
import { cards } from "$lib/db/schema/cards";
import { eq, and, max, sql } from "drizzle-orm";

export const load: PageServerLoad = async ({ params }) => {
  const board = await db.query.boards.findFirst({
    where: (boards, { eq }) => eq(boards.id, params.boardId),
    with: {
      columns: {
        orderBy: (columns, { asc }) => [asc(columns.position)],
        with: {
          cards: {
            orderBy: (cards, { asc }) => [asc(cards.position)],
            with: {
              cardLabels: { with: { label: true } },
            },
          },
        },
      },
    },
  });

  if (!board) throw error(404, "Board not found");

  const createColumnForm = await superValidate(zod4(createColumnSchema));
  const createCardForm = await superValidate(zod4(createCardSchema));

  return { board, createColumnForm, createCardForm };
};

export const actions: Actions = {
  createColumn: async ({ request, params }) => {
    const form = await superValidate(request, zod4(createColumnSchema));
    if (!form.valid) return fail(400, { createColumnForm: form });

    const [maxPos] = await db
      .select({ value: max(columns.position) })
      .from(columns)
      .where(eq(columns.boardId, params.boardId));

    await db.insert(columns).values({
      boardId: params.boardId,
      name: form.data.name,
      position: (maxPos.value ?? -1) + 1,
    });

    return { createColumnForm: form };
  },

  renameColumn: async ({ request, params }) => {
    const form = await superValidate(request, zod4(renameColumnSchema));
    if (!form.valid) return fail(400, { form });

    const formData = await request.clone().formData();
    const columnId = formData.get("columnId") as string;

    await db
      .update(columns)
      .set({ name: form.data.name, updatedAt: new Date() })
      .where(and(eq(columns.id, columnId), eq(columns.boardId, params.boardId)));

    return { form };
  },

  deleteColumn: async ({ request, params }) => {
    const form = await superValidate(request, zod4(deleteColumnSchema));
    if (!form.valid) return fail(400, { form });

    const formData = await request.clone().formData();
    const columnId = formData.get("columnId") as string;

    await db.transaction(async (tx) => {
      if (form.data.moveCardsTo) {
        await tx
          .update(cards)
          .set({ columnId: form.data.moveCardsTo })
          .where(eq(cards.columnId, columnId));
      }

      await tx
        .delete(columns)
        .where(and(eq(columns.id, columnId), eq(columns.boardId, params.boardId)));
    });

    return { form };
  },

  createCard: async ({ request }) => {
    const form = await superValidate(request, zod4(createCardSchema));
    if (!form.valid) return fail(400, { createCardForm: form });

    const formData = await request.clone().formData();
    const columnId = formData.get("columnId") as string;

    await db.transaction(async (tx) => {
      await tx
        .update(cards)
        .set({ position: sql`${cards.position} + 1` })
        .where(eq(cards.columnId, columnId));

      await tx.insert(cards).values({
        columnId,
        title: form.data.title,
        position: 0,
      });
    });

    return { createCardForm: form };
  },

  deleteCard: async ({ request }) => {
    const form = await superValidate(request, zod4(deleteCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.delete(cards).where(eq(cards.id, form.data.cardId));

    return { form };
  },
};
