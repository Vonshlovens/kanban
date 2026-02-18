import { z } from "zod/v4";

export const createCardSchema = z.object({
  title: z.string().min(1, "Card title is required").max(500),
});

export const updateCardSchema = z.object({
  title: z.string().min(1, "Card title is required").max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
});

export const moveCardSchema = z.object({
  cardId: z.string().uuid(),
  targetColumnId: z.string().uuid(),
  position: z.coerce.number().int().min(0),
});

export const deleteCardSchema = z.object({
  cardId: z.string().uuid(),
});

export const reorderCardsSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1),
});
