import { z } from "zod/v4";

export const createBoardSchema = z.object({
  name: z.string().min(1, "Board name is required").max(100),
  description: z.string().max(500).optional(),
});

export const renameBoardSchema = z.object({
  name: z.string().min(1, "Board name is required").max(100),
});

export const updateBoardDescriptionSchema = z.object({
  description: z.string().max(500),
});
