import path from 'path'

// Library roots come from env so tests can point at synthetic libraries;
// defaults match the production container's volume mounts.
export const MANGA_ROOT = process.env.MANGA_ROOT || '/mnt/d/manga'
export const MANGA_XL_ROOT = process.env.MANGA_XL_ROOT || '/mnt/d/manga-xl'
export const META_DIR = path.join(MANGA_ROOT, '.meta')
export const THUMB_DIR = path.join(MANGA_ROOT, '.thumb')
export const BINDS_DIR = path.join(MANGA_ROOT, '.binds')
export const SERVER_ID_PATH = process.env.SERVER_ID_PATH || path.join(MANGA_ROOT, '.server-id')
