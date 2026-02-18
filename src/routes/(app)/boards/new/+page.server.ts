import type { PageServerLoad, Actions } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { createBoardSchema } from "$lib/schemas/board";
import { db } from "$lib/db";
import { boards } from "$lib/db/schema/boards";
import { columns } from "$lib/db/schema/columns";

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod4(createBoardSchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod4(createBoardSchema));
    if (!form.valid) return fail(400, { form });

    const [board] = await db.transaction(async (tx) => {
      const [board] = await tx
        .insert(boards)
        .values({
          name: form.data.name,
          description: form.data.description,
        })
        .returning();

      await tx.insert(columns).values([
        { boardId: board.id, name: "To Do", position: 0 },
        { boardId: board.id, name: "In Progress", position: 1 },
        { boardId: board.id, name: "Done", position: 2 },
      ]);

      return [board];
    });

    throw redirect(303, `/boards/${board.id}`);
  },
};
