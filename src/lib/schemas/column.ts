import { z } from "zod/v4";

export const createColumnSchema = z.object({
  name: z.string().min(1, "Column name is required").max(100),
});

export const renameColumnSchema = z.object({
  name: z.string().min(1, "Column name is required").max(100),
});

export const updateWipLimitSchema = z.object({
  wipLimit: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" || v === 0 ? null : v)),
});

export const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string().uuid()).min(1),
});

export const deleteColumnSchema = z.object({
  moveCardsTo: z.string().uuid().optional(),
});
