# M4-13 — Orquestrador de sync (primeiro plano e segundo plano)

**Marco:** mobile v1 · **Depende de:** M4-06, M4-10, M4-11, M4-12

## Objetivo
Um único ponto que executa o ciclo de sincronização (health, catálogo, bind e fila) no primeiro plano e numa tarefa periódica em segundo plano (~15 min, só em Wi-Fi), com orçamento de tempo, sem sobreposição e sem nunca lançar exceções.

## Contexto mínimo
- Funções existentes, que nunca lançam:
  - `checkServer` (M4-05);
  - `syncCatalog` (M4-06);
  - `syncBind` (M4-12);
  - `drainQueue(deps, { deadlineMs })` (M4-10/M4-11);
  - `enforceSpace` (M4-08);
  - `reconcile`/`reconcileTransient` (M4-08/M4-09).
- O segundo plano usa `expo-background-task` (que roda sobre o WorkManager, com intervalo mínimo de 15 min e sem horário garantido) mais `expo-task-manager`. A tarefa precisa ser definida no **escopo global** do bundle (fora de componentes).
- Condição de segundo plano: Wi-Fi (`expo-network`: `getNetworkStateAsync().type === NetworkStateType.WIFI`) **e** servidor `online` **e** status diferente de `mismatch`. Sem essas condições, o ciclo encerra cedo e com sucesso.
- O orçamento em segundo plano é de ~25 s no total.
- Ordem do ciclo: `checkServer`; se online, `syncBind`, depois `syncCatalog`, depois `drainQueue(restante do orçamento)`; e sempre `enforceSpace` no final (também offline, por decisão).
- No primeiro plano: ao abrir o app, ao voltar a `active`, ao mudar para `online` e por um botão "Sincronizar agora" (M4-18). Sem prazo para o drain.
- No `diag_log`: uma linha `info` por ciclo (`scope='cycle'`), com a duração e o que rodou.

## Início
- M4-06, M4-10, M4-11 e M4-12 commitados.

## Meio
1. `npx expo install expo-background-task expo-task-manager expo-network`.
2. `apps/mobile/src/sync/cycle.ts`: `runCycle({ mode: 'foreground' | 'background', budgetMs? })`, com um lock global (se já houver um ciclo rodando, devolve o mesmo `Promise`) e try/catch por etapa.
3. `apps/mobile/src/sync/backgroundTask.ts`: `TaskManager.defineTask(SYNC_TASK, ...)` chamando `runCycle({ mode: 'background', budgetMs: 25000 })` e devolvendo `BackgroundTaskResult.Success` (também quando o ciclo é pulado), e `registerSyncTask()` com `minimumInterval: 15`. Importar o arquivo no entry (`app/_layout.tsx`) para que a tarefa seja definida no carregamento do bundle.
4. `apps/mobile/src/sync/useForegroundSync.ts`: liga os gatilhos de primeiro plano.
5. Uma tela de desenvolvimento, só em `__DEV__`, em `app/dev.tsx`, com o botão "Disparar tarefa de background", que chama `BackgroundTask.triggerTaskWorkerForTestingAsync()`.
6. Testes de `runCycle` com todas as dependências falsas:
   - offline: só `enforceSpace` roda;
   - em segundo plano sem Wi-Fi: só `enforceSpace`;
   - `mismatch`: nada além de `enforceSpace`;
   - uma etapa que lança não impede as seguintes;
   - duas chamadas simultâneas executam uma vez;
   - o orçamento é repassado ao drain.

## Fim
- Testes passando.
- No emulador (Wi-Fi do emulador ligado): enfileirar um download por uma tela de debug, colocar o app em segundo plano, disparar a tarefa pela tela dev (ou com `adb shell cmd jobscheduler run -f com.dcrispim.mangareader <jobId>`) e verificar no `diag_log` uma linha `cycle` em modo background e o job concluído.

## Arquivos
- Criar: `apps/mobile/src/sync/{cycle.ts,backgroundTask.ts,useForegroundSync.ts}`, `apps/mobile/app/dev.tsx`, `apps/mobile/src/sync/__tests__/cycle.test.ts`
- Modificar: `apps/mobile/app/_layout.tsx`, `apps/mobile/package.json`, `pnpm-lock.yaml`

## Fora do escopo
Foreground service com notificação (fora da v1).

## Commit
`Add the sync cycle orchestrator with a background task`
