import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { LogLine } from './text';
import { logToText } from './text';

/** Writes the log as a .txt in the cache dir and opens the Android share sheet. */
export async function exportLog(lines: LogLine[]): Promise<boolean> {
  try {
    const file = new File(Paths.cache, 'manga-reader-log.txt');
    file.create({ overwrite: true });
    file.write(logToText(lines));
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: 'Exportar log' });
    return true;
  } catch {
    return false;
  }
}
