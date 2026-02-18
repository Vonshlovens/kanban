import { z } from "zod/v4";

export const createLabelSchema = z.object({
  name: z.string().min(1, "Label name is required").max(50),
  color: z.string().min(1, "Color is required"),
});

export const updateLabelSchema = z.object({
  labelId: z.string().uuid(),
  name: z.string().min(1, "Label name is required").max(50),
  color: z.string().min(1, "Color is required"),
});

export const deleteLabelSchema = z.object({
  labelId: z.string().uuid(),
});

export const toggleCardLabelSchema = z.object({
  cardId: z.string().uuid(),
  labelId: z.string().uuid(),
});
