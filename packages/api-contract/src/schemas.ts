import { z } from 'zod';
import {
  EMPTY_METADATA,
  type MetadataContent,
  type BindData as CoreBindData,
  type BindPayload as CoreBindPayload,
  type TitleHistory,
} from '@manga/core';

/**
 * Tolerant schemas: use .passthrough() or .strip() instead of .strict()
 * so the app doesn't break when the server gains a new field.
 */

// ============ Metadata ============
export const MetadataSchema = z.object({
  categories: z.array(z.string()),
  author: z.string(),
  volumes: z.string(),
  status: z.string(),
  type: z.string(),
  demographic: z.string(),
  published: z.string(),
  description: z.string(),
}).passthrough();

export type Metadata = z.infer<typeof MetadataSchema>;

// ============ List / Catalog ============
export const ListItemSchema = z.object({
  name: z.string(),
  caps: z.number().int(),
  description: z.string(),
  link: z.string(),
  thumb: z.string(),
}).passthrough();

export type ListItem = z.infer<typeof ListItemSchema>;

export const ListResponseSchema = z.array(ListItemSchema);
export type ListResponse = z.infer<typeof ListResponseSchema>;

// ============ Read: Title ============
export const ReadTitleResponseSchema = z.object({
  chapters: z.array(z.string()),
  modified: z.record(z.string(), z.number()),
}).passthrough();

export type ReadTitleResponse = z.infer<typeof ReadTitleResponseSchema>;

// ============ Read: Chapter ============
export const ReadChapterResponseSchema = z.object({
  images: z.array(z.string()),
}).passthrough();

export type ReadChapterResponse = z.infer<typeof ReadChapterResponseSchema>;

// ============ Read: Chapter XL ============
export const ReadChapterXlResponseSchema = ReadChapterResponseSchema;
export type ReadChapterXlResponse = z.infer<typeof ReadChapterXlResponseSchema>;

// ============ Upscale Status ============
export const UpscaleStatusSchema = z.enum(['pending', 'processing', 'done', 'error']);
export type UpscaleStatus = z.infer<typeof UpscaleStatusSchema>;

export const UpscaleResponseSchema = z.object({
  status: UpscaleStatusSchema.nullable(),
  alreadyUpscaled: z.boolean().optional(),
}).passthrough();

export type UpscaleResponse = z.infer<typeof UpscaleResponseSchema>;

// ============ Metadata Response ============
export const MetadataResponseSchema = MetadataSchema.extend({
  thumbSource: z.enum(['curated', 'crop']),
}).passthrough();

export type MetadataResponse = z.infer<typeof MetadataResponseSchema>;

// ============ Bind ============
// TitleHistory: { lastRead: number | null, history: string[], openedAt: Record<string, number> }
export const TitleHistorySchema: z.ZodType<TitleHistory> = z.object({
  lastRead: z.number().nullable(),
  history: z.array(z.string()),
  openedAt: z.record(z.string(), z.number()),
});

export const BindPayloadSchema: z.ZodType<CoreBindPayload> = z.object({
  history: z.record(z.string(), TitleHistorySchema),
  chapters: z.record(z.string(), z.string()),
});

export const BindDataSchema: z.ZodType<CoreBindData> = z.object({
  history: z.record(z.string(), TitleHistorySchema),
  chapters: z.record(z.string(), z.string()),
  code: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
}).passthrough();

export type BindPayload = CoreBindPayload;
export type BindData = CoreBindData;

// ============ Health ============
export const HealthResponseSchema = z.object({
  serverId: z.string().optional(),
  version: z.string(),
  features: z.array(z.string()),
}).passthrough();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ============ Catalog ============
export const CatalogChapterSchema = z.object({
  id: z.string(),
  number: z.number(),
  pages: z.number().int(),
  mtimeMs: z.number(),
});

export type CatalogChapter = z.infer<typeof CatalogChapterSchema>;

export const CatalogThumbSchema = z.object({
  url: z.string(),
  version: z.string(),
}).nullable();

export type CatalogThumb = z.infer<typeof CatalogThumbSchema>;

export const CatalogTitleSchema = z.object({
  name: z.string(),
  mtimeMs: z.number(),
  metadata: MetadataSchema,
  categories: z.array(z.string()),
  thumb: CatalogThumbSchema,
  chapters: z.array(CatalogChapterSchema),
}).passthrough();

export type CatalogTitle = z.infer<typeof CatalogTitleSchema>;

export const CatalogResponseSchema = z.object({
  serverTime: z.number(),
  since: z.number(),
  full: z.boolean(),
  allTitleNames: z.array(z.string()),
  titles: z.array(CatalogTitleSchema),
}).passthrough();

export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

// ============ Categories ============
export const CategoryInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
});

export type CategoryInfo = z.infer<typeof CategoryInfoSchema>;

export const CategoriesResponseSchema = z.object({
  categories: z.array(CategoryInfoSchema),
}).passthrough();

export type CategoriesResponse = z.infer<typeof CategoriesResponseSchema>;

export const CategoryTitlesSchema = z.object({
  titles: z.array(z.string()),
});

export type CategoryTitles = z.infer<typeof CategoryTitlesSchema>;

// ============ Error Response ============
export const ErrorResponseSchema = z.object({
  error: z.string(),
}).passthrough();

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const MessageErrorResponseSchema = z.object({
  message: z.string(),
}).passthrough();

export type MessageErrorResponse = z.infer<typeof MessageErrorResponseSchema>;
