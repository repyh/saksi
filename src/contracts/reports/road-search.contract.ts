import { z } from "zod";

export const roadGroupQuerySchema = z.object({
  region: z.string().trim().max(80).optional(),
  q: z.string().trim().max(120).optional(),
});

export const roadSegmentQuerySchema = roadGroupQuerySchema.extend({
  name: z.string().trim().max(180).optional(),
  unnamed: z.enum(["0", "1"]).optional(),
});

export const roadGroupSchema = z.object({
  name: z.string().nullable(),
  count: z.number().int().positive(),
});

export const roadGroupsResponseSchema = z.object({
  groups: z.array(roadGroupSchema),
});

export const roadSegmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  number: z.string().nullable(),
  roadClass: z.string(),
  surface: z.string().nullable(),
  lengthM: z.number().nullable(),
  widthM: z.number().nullable(),
  geometry: z.object({
    type: z.enum(["LineString", "MultiLineString"]),
    coordinates: z.array(z.unknown()),
  }),
});

export const roadSegmentsResponseSchema = z.object({
  segments: z.array(roadSegmentSchema),
});

export type RoadGroup = z.infer<typeof roadGroupSchema>;
export type RoadSegment = z.infer<typeof roadSegmentSchema>;
export type RoadGroupsResponse = z.infer<typeof roadGroupsResponseSchema>;
export type RoadSegmentsResponse = z.infer<typeof roadSegmentsResponseSchema>;
