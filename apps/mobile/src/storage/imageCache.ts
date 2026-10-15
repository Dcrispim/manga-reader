import { Image } from 'expo-image';

/**
 * Drops expo-image's memory and disk caches. Remote pages (upscaled ones in
 * particular) live only there, and downloaded pages keep their file name when
 * replaced, so without this a stale image keeps showing after a cleanup.
 */
export async function clearImageCaches(): Promise<void> {
  try {
    await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
  } catch {
    // Best effort: a stale cached image is not worth failing the caller.
  }
}

/** Memory cache only: enough after local files change under the same path. */
export async function clearImageMemoryCache(): Promise<void> {
  try {
    await Image.clearMemoryCache();
  } catch {
    // Best effort.
  }
}
