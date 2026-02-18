import { z } from "zod/v4";

export const createCommentSchema = z.object({
  cardId: z.string().uuid(),
  content: z.string().min(1, "Comment cannot be empty").max(10000),
});

export const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  content: z.string().min(1, "Comment cannot be empty").max(10000),
});

export const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});
