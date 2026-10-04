# M4-10 — Fila persistente de downloads ("baixar quando disponível")

**Marco:** mobile v1 · **Depende de:** M4-09

## Objetivo
Criar uma fila de jobs gravada no SQLite que baixa capítulos quando o servidor estiver acessível, retoma da página onde parou, respeita o piso de disco (pausando, sem falhar) e nunca lança exceções.

## Contexto mínimo
- Tabela `jobs(id, kind 'download'|'upgrade', title, chapter, state 'queued'|'running'|'paused'|'done'|'failed', pages_done, pages_total, attempts, next_attempt_at, last_error, created_at, unique(kind,title,chapter))` (M4-03).
- Enfileirar é idempotente: enfileirar de novo um job existente o reativa, mas não o duplica.
- O drain só roda com o status do servidor `online` (M4-05). Em segundo plano, também precisa de Wi-Fi (verificado pelo orquestrador em M4-13, não aqui).
- Concorrência: **2** requisições de imagem simultâneas no total, para não sobrecarregar um servidor pequeno.
- Retomada: as páginas que já existem em `<chapter>.tmp/` (M4-08) com tamanho maior que 0 são puladas.
- Antes de começar um job: se o capítulo estiver completo no cache transitório, usar `promoteToDownload` (M4-09) e concluir sem rede. Senão, calcular `projectChapterBytes(pages)` e `canAdmit(freeDisk, projected, minFreeBytes)` (`@manga/core`). Se não couber, o estado vira `paused` com `last_error='no_space'` (a UI mostra "aguardando espaço").
- Falha de rede ou do servidor: `attempts++`, `next_attempt_at = now + backoff` (1 min, 5 min, 15 min, 1 h, e depois 1 h para sempre), estado `queued`. **Nunca** vira `failed` por causa de rede. Vira `failed` só quando o servidor responde 404 para o capítulo (ele não existe mais).
- Ao concluir: `commitChapter` (M4-08), que já aplica a evicção.
- Setting `downloads.autoNext` (padrão `false`): ao abrir o capítulo N no leitor, enfileirar N+1 (usado em M4-15).

## Início
- M4-09 commitado.

## Meio
1. `apps/mobile/src/jobs/repo.ts`: `enqueue(db, kind, title, chapter)`, `cancel`, `listActive`, `nextRunnable(now)`, `markRunning`, `markProgress`, `markDone`, `markFailed`, `reschedule` e `recoverInterrupted()` (os jobs `running` encontrados na inicialização voltam para `queued`).
2. `apps/mobile/src/jobs/downloadWorker.ts`: `runDownloadJob(job, deps): Promise<'done' | 'paused' | 'retry' | 'failed'>`.
3. `apps/mobile/src/jobs/drain.ts`: `drainQueue(deps, { deadlineMs, onlyKinds? })`, que processa os jobs executáveis até o prazo (em segundo plano, cerca de 25 s; em primeiro plano, sem prazo), com um semáforo global de 2 páginas e um lock contra drains simultâneos. Os jobs `paused` por espaço voltam para `queued` quando `canAdmit` passar a ser verdadeiro.
4. Primeiro plano: drenar sempre que o status mudar para `online` e sempre que um job for enfileirado.
5. Testes (`testDb`, `memoryFileStore`, cliente falso com falhas programáveis):
   - download completo;
   - queda no meio (página 7 de 15): o job volta a `queued`, e a retomada só baixa as páginas de 8 a 15;
   - sem espaço: `paused`, e retoma quando há espaço;
   - 404: `failed`;
   - backoff progressivo;
   - enfileirar duas vezes: um único job;
   - promoção a partir do cache transitório sem chamadas de rede;
   - concorrência nunca acima de 2 (contar requisições simultâneas no fake);
   - `recoverInterrupted`.

## Fim
- `pnpm --filter @manga/mobile test` passa.

## Arquivos
- Criar: `apps/mobile/src/jobs/{repo.ts,downloadWorker.ts,drain.ts}`, `apps/mobile/src/jobs/__tests__/{repo,downloadWorker,drain}.test.ts`

## Fora do escopo
Jobs de upgrade (M4-11). Agendamento em segundo plano (M4-13). UI da fila (M4-18).

## Commit
`Add the persistent download queue with resume and backoff`
