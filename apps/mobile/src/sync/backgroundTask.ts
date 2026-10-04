import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { runCycle } from './cycle';

export const SYNC_TASK = 'manga-sync-cycle';
export const BACKGROUND_BUDGET_MS = 25_000;

// Must run at bundle load (global scope): the OS may start the JS runtime just
// to run this task, long before any component mounts.
TaskManager.defineTask(SYNC_TASK, async () => {
  // runCycle never rejects; a skipped cycle (no Wi-Fi, offline) is a success too.
  await runCycle({ mode: 'background', budgetMs: BACKGROUND_BUDGET_MS });
  return BackgroundTask.BackgroundTaskResult.Success;
});

/** Registers the periodic task (15 min is the platform minimum). Never throws. */
export async function registerSyncTask(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK)) return;
    await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 15 });
  } catch {
    // Background sync is a bonus; the foreground cycle still works.
  }
}
