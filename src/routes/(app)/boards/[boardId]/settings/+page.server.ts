import type { PageServerLoad, Actions } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import {
  renameBoardSchema,
  updateBoardDescriptionSchema,
} from "$lib/schemas/board";
import {
  createLabelSchema,
  updateLabelSchema,
  deleteLabelSchema,
} from "$lib/schemas/label";
import { db } from "$lib/db";
import { boards } from "$lib/db/schema/boards";
import { labels } from "$lib/db/schema/labels";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ params }) => {
  const board = await db.query.boards.findFirst({
    where: (boards, { eq }) => eq(boards.id, params.boardId),
    with: {
      labels: true,
    },
  });

  if (!board) throw error(404, "Board not found");

  const renameForm = await superValidate(
    { name: board.name },
    zod4(renameBoardSchema),
  );
  const descriptionForm = await superValidate(
    { description: board.description ?? "" },
    zod4(updateBoardDescriptionSchema),
  );

  return { board, boardLabels: board.labels, renameForm, descriptionForm };
};

export const actions: Actions = {
  rename: async ({ request, params }) => {
    const form = await superValidate(request, zod4(renameBoardSchema));
    if (!form.valid) return fail(400, { renameForm: form });

    await db
      .update(boards)
      .set({ name: form.data.name, updatedAt: new Date() })
      .where(eq(boards.id, params.boardId));

    return { renameForm: form };
  },

  updateDescription: async ({ request, params }) => {
    const form = await superValidate(
      request,
      zod4(updateBoardDescriptionSchema),
    );
    if (!form.valid) return fail(400, { descriptionForm: form });

    await db
      .update(boards)
      .set({ description: form.data.description, updatedAt: new Date() })
      .where(eq(boards.id, params.boardId));

    return { descriptionForm: form };
  },

  delete: async ({ params }) => {
    await db.delete(boards).where(eq(boards.id, params.boardId));
    throw redirect(303, "/");
  },

  toggleFavorite: async ({ params }) => {
    const board = await db.query.boards.findFirst({
      where: (boards, { eq }) => eq(boards.id, params.boardId),
      columns: { isFavorite: true },
    });

    if (!board) throw error(404, "Board not found");

    await db
      .update(boards)
      .set({ isFavorite: !board.isFavorite, updatedAt: new Date() })
      .where(eq(boards.id, params.boardId));
  },

  createLabel: async ({ request, params }) => {
    const form = await superValidate(request, zod4(createLabelSchema));
    if (!form.valid) return fail(400, { form });

    await db.insert(labels).values({
      boardId: params.boardId,
      name: form.data.name,
      color: form.data.color,
    });

    return { form };
  },

  updateLabel: async ({ request }) => {
    const form = await superValidate(request, zod4(updateLabelSchema));
    if (!form.valid) return fail(400, { form });

    await db
      .update(labels)
      .set({ name: form.data.name, color: form.data.color })
      .where(eq(labels.id, form.data.labelId));

    return { form };
  },

  deleteLabel: async ({ request }) => {
    const form = await superValidate(request, zod4(deleteLabelSchema));
    if (!form.valid) return fail(400, { form });

    await db.delete(labels).where(eq(labels.id, form.data.labelId));

    return { form };
  },
};
