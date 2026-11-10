import { z } from "zod";

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
  region: z.string().trim().max(80).optional(),
});

export const geocodeResultSchema = z.object({
  label: z.string(),
  name: z.string().nullable(),
  street: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  osmType: z.string().nullable(),
  osmId: z.number().nullable(),
});

export const geocodeResponseSchema = z.object({
  results: z.array(geocodeResultSchema),
  attribution: z.string(),
});

export type GeocodeResult = z.infer<typeof geocodeResultSchema>;
export type GeocodeResponse = z.infer<typeof geocodeResponseSchema>;
