import { z } from 'zod';

export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export interface ReviewDto {
  id: string;
  orderId: string;
  masterId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}
