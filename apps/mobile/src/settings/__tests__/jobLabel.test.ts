import { jobLabel } from '../jobLabel';
import { logToText } from '../../diag/text';

describe('jobLabel', () => {
  it('maps each state', () => {
    const base = { attempts: 0, pagesDone: 0, pagesTotal: null as number | null };
    expect(jobLabel({ ...base, state: 'queued' })).toBe('Na fila');
    expect(jobLabel({ ...base, state: 'queued', attempts: 2 })).toBe('Aguardando servidor');
    expect(jobLabel({ ...base, state: 'running', pagesDone: 3, pagesTotal: 12 })).toBe('Baixando 3/12');
    expect(jobLabel({ ...base, state: 'running' })).toBe('Baixando');
    expect(jobLabel({ ...base, state: 'paused' })).toBe('Aguardando espaço');
    expect(jobLabel({ ...base, state: 'failed' })).toBe('Falhou');
  });
});

describe('logToText', () => {
  it('renders one line per entry', () => {
    const at = new Date(2026, 9, 4, 1, 2).getTime();
    expect(logToText([{ at, level: 'info', scope: 'cycle', message: 'ok' }])).toBe(
      '04/10/2026 01:02 [info] cycle: ok',
    );
  });
});
