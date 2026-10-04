import type { Job } from '../jobs/repo';

/** pt-BR status line of a job in the queue screen. */
export function jobLabel(job: Pick<Job, 'state' | 'attempts' | 'pagesDone' | 'pagesTotal'>): string {
  switch (job.state) {
    case 'running':
      return job.pagesTotal ? `Baixando ${job.pagesDone}/${job.pagesTotal}` : 'Baixando';
    case 'paused':
      return 'Aguardando espaço';
    case 'failed':
      return 'Falhou';
    default:
      // Backoff after a network/server problem: the job waits for the server.
      return job.attempts > 0 ? 'Aguardando servidor' : 'Na fila';
  }
}
