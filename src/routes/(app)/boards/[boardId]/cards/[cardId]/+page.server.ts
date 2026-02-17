import type { PageServerLoad, Actions } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { updateCardSchema, deleteCardSchema } from "$lib/schemas/card";
import {
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
} from "$lib/schemas/comment";
import { toggleCardLabelSchema } from "$lib/schemas/label";
import { db } from "$lib/db";
import { cards } from "$lib/db/schema/cards";
import { comments } from "$lib/db/schema/comments";
import { columns } from "$lib/db/schema/columns";
import { cardLabels } from "$lib/db/schema/card-labels";
import { labels } from "$lib/db/schema/labels";
import { eq, and, asc } from "drizzle-orm";
import { getDefaultUser } from "$lib/server/auth";

export const load: PageServerLoad = async ({ params }) => {
  const [card, currentUser] = await Promise.all([
    db.query.cards.findFirst({
      where: (cards, { eq }) => eq(cards.id, params.cardId),
      with: {
        column: true,
        cardLabels: { with: { label: true } },
        comments: {
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
          with: {
            author: true,
          },
        },
      },
    }),
    getDefaultUser(),
  ]);

  if (!card) throw error(404, "Card not found");

  const [boardColumns, boardLabels] = await Promise.all([
    db
      .select({ id: columns.id, name: columns.name })
      .from(columns)
      .where(eq(columns.boardId, params.boardId))
      .orderBy(asc(columns.position)),
    db
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(labels)
      .where(eq(labels.boardId, params.boardId)),
  ]);

  const updateForm = await superValidate(
    { title: card.title, description: card.description ?? "" },
    zod4(updateCardSchema),
  );

  return {
    card,
    boardId: params.boardId,
    columns: boardColumns,
    boardLabels,
    updateForm,
    currentUserId: currentUser.id,
  };
};

export const actions: Actions = {
  update: async ({ request, params }) => {
    const form = await superValidate(request, zod4(updateCardSchema));
    if (!form.valid) return fail(400, { updateForm: form });

    await db
      .update(cards)
      .set({ ...form.data, updatedAt: new Date() })
      .where(eq(cards.id, params.cardId));

    return { updateForm: form };
  },

  deleteCard: async ({ request, params }) => {
    const form = await superValidate(request, zod4(deleteCardSchema));
    if (!form.valid) return fail(400, { form });

    await db.delete(cards).where(eq(cards.id, form.data.cardId));

    throw redirect(303, `/boards/${params.boardId}`);
  },

  createComment: async ({ request }) => {
    const form = await superValidate(request, zod4(createCommentSchema));
    if (!form.valid) return fail(400, { form });

    const user = await getDefaultUser();

    await db.insert(comments).values({
      cardId: form.data.cardId,
      authorId: user.id,
      content: form.data.content,
    });

    return { form };
  },

  updateComment: async ({ request }) => {
    const form = await superValidate(request, zod4(updateCommentSchema));
    if (!form.valid) return fail(400, { form });

    const user = await getDefaultUser();
    const comment = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, form.data.commentId),
    });

    if (!comment || comment.authorId !== user.id) {
      return fail(403, { form });
    }

    await db
      .update(comments)
      .set({ content: form.data.content, updatedAt: new Date() })
      .where(eq(comments.id, form.data.commentId));

    return { form };
  },

  deleteComment: async ({ request }) => {
    const form = await superValidate(request, zod4(deleteCommentSchema));
    if (!form.valid) return fail(400, { form });

    const user = await getDefaultUser();
    const comment = await db.query.comments.findFirst({
      where: (c, { eq }) => eq(c.id, form.data.commentId),
    });

    if (!comment || comment.authorId !== user.id) {
      return fail(403, { form });
    }

    await db.delete(comments).where(eq(comments.id, form.data.commentId));

    return { form };
  },

  toggleLabel: async ({ request }) => {
    const form = await superValidate(request, zod4(toggleCardLabelSchema));
    if (!form.valid) return fail(400, { form });

    const existing = await db.query.cardLabels.findFirst({
      where: (cl, { and, eq }) =>
        and(eq(cl.cardId, form.data.cardId), eq(cl.labelId, form.data.labelId)),
    });

    if (existing) {
      await db
        .delete(cardLabels)
        .where(
          and(
            eq(cardLabels.cardId, form.data.cardId),
            eq(cardLabels.labelId, form.data.labelId),
          ),
        );
    } else {
      await db.insert(cardLabels).values({
        cardId: form.data.cardId,
        labelId: form.data.labelId,
      });
    }

    return { form };
  },
};
