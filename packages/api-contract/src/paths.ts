/**
 * URL path constructors for API routes.
 * Each path properly encodes segments using encodeURIComponent.
 */

export const paths = {
  /**
   * GET /api/list - list all visible titles
   */
  list: () => '/api/list',

  /**
   * GET /api/health - server health and features
   */
  health: () => '/api/health',

  /**
   * GET /api/catalog?since=<timestamp> - catalog with all titles and chapters
   */
  catalog: (since?: number) => `/api/catalog${since !== undefined ? `?since=${since}` : ''}`,

  /**
   * GET /api/read/:title - list chapters for a title
   */
  readTitle: (title: string) => `/api/read/${encodeURIComponent(title)}`,

  /**
   * GET /api/read/:title/:chapter - list images for a chapter
   */
  readChapter: (title: string, chapter: string) =>
    `/api/read/${encodeURIComponent(title)}/${encodeURIComponent(chapter)}`,

  /**
   * GET /api/read/:title/:chapter/:index - fetch an image
   */
  readImage: (title: string, chapter: string, index: number) =>
    `/api/read/${encodeURIComponent(title)}/${encodeURIComponent(chapter)}/${index}`,

  /**
   * GET /api/read/:title/:chapter/thumb - fetch chapter thumbnail
   */
  readThumb: (title: string, chapter: string) =>
    `/api/read/${encodeURIComponent(title)}/${encodeURIComponent(chapter)}/thumb`,

  /**
   * GET /api/read/:title/:chapter/xl - list upscaled images (if available)
   */
  readChapterXl: (title: string, chapter: string) =>
    `/api/read/${encodeURIComponent(title)}/${encodeURIComponent(chapter)}/xl`,

  /**
   * GET /api/read/:title/:chapter/upscale - check upscale status
   */
  upscaleStatus: (title: string, chapter: string) =>
    `/api/read/${encodeURIComponent(title)}/${encodeURIComponent(chapter)}/upscale`,

  /**
   * POST /api/read/:title/:chapter/upscale - start upscaling (if not already done)
   */
  upscaleStart: (title: string, chapter: string) =>
    `/api/read/${encodeURIComponent(title)}/${encodeURIComponent(chapter)}/upscale`,

  /**
   * GET /api/metadata/:title - fetch metadata for a title
   */
  metadata: (title: string) => `/api/metadata/${encodeURIComponent(title)}`,

  /**
   * GET /api/categories - list all categories
   */
  categories: () => '/api/categories',

  /**
   * GET /api/categories/:categoryId - get titles in a category
   */
  category: (categoryId: string) => `/api/categories/${encodeURIComponent(categoryId)}`,

  /**
   * POST /api/bind - create new bind (progress sync)
   */
  bindCreate: () => '/api/bind',

  /**
   * GET /api/bind/:code - fetch bind by code
   */
  bindGet: (code: string) => `/api/bind/${encodeURIComponent(code)}`,

  /**
   * POST /api/bind/:code - merge into existing bind
   */
  bindUpdate: (code: string) => `/api/bind/${encodeURIComponent(code)}`,
};

/**
 * Resolve a relative URL against a base URL.
 * Handles both `/path` and `path` formats.
 */
export function resolveUrl(base: string, relative: string): string {
  // Ensure base ends without trailing slash and relative starts with /
  const cleanBase = base.replace(/\/$/, '');
  const cleanRelative = relative.startsWith('/') ? relative : `/${relative}`;
  return `${cleanBase}${cleanRelative}`;
}
