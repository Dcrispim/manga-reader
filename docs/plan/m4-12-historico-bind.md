# M4-12 — Histórico local e sync engine do bind

**Marco:** mobile v1 · **Depende de:** M4-05

## Objetivo
Registrar localmente a abertura de capítulos, com a mesma semântica do web, e sincronizar o progresso com os outros aparelhos através do `bind` existente: deltas pendentes enviados quando o servidor estiver acessível e merge idempotente.

## Contexto mínimo
- `@manga/core` (M2-06): `TitleHistory = { lastRead, history: string[], openedAt: Record<chapter, ms> }`, `recordChapterOpen(history, title, chapter, now)` (o timestamp é gravado só na primeira abertura; mantém os 5 últimos), `buildDeltaPayload(full, since)`, `mergeBindData(local, remote)` e `getLatestChapter`.
- Tabela `history(title, chapter, opened_at, pending)` (M4-03). A visão `Record<string, TitleHistory>` é derivada dela: `openedAt` por título; `history` = os 5 de maior `opened_at`; `lastRead` = o máximo.
- Servidor (contrato inalterado):
  - `POST /api/bind` com `{ history, chapters }` cria um código e devolve `BindData = { code, createdAt, updatedAt, history, chapters }`;
  - `GET /api/bind/<code>` devolve `BindData`, ou 404;
  - `POST /api/bind/<code>` com `{ history, chapters }` faz o merge no servidor e devolve o `BindData` mesclado.
- Settings: `bind.code`, `bind.lastSync` (ms) e `bind.chapters` (JSON do ponteiro "continuar de").
- "Lido" (para a evicção) = existe uma linha em `history`. Depois do merge, o que veio de outros aparelhos também é inserido, então conta como lido.

## Início
- M4-05 commitado.

## Meio
1. `apps/mobile/src/history/repo.ts`:
   - `recordOpen(db, title, chapter, now)`: insere com `pending=1` **somente se** a linha não existir (semântica do `recordChapterOpen`);
   - `toTitleHistories(db)`;
   - `applyMerged(db, merged)`: insere os `openedAt` que ainda não existem com `pending=0`, e com `opened_at` já existente faz `max` (como no merge);
   - `isRead(db, title, chapter)`;
   - `latestChapter(db, title)`.
2. `apps/mobile/src/sync/bind.ts`:
   - `createBind(...)` e `connectBind(code)`. O `connectBind` faz GET; com 404, devolve o resultado `not_found` para a UI; com sucesso, aplica o merge local e salva o código;
   - `syncBind({ db, client, now })`: sem código, ou com o servidor não `online`, faz skip. Senão: `delta = buildDeltaPayload(full, lastSync)`, depois `POST /api/bind/<code>` com o delta, depois `merged = mergeBindData(local, resposta)`, `applyMerged`, marca `pending=0` em tudo o que foi enviado e grava `lastSync = now` capturado **antes** do envio. Falha em qualquer etapa: nada é marcado e o próximo ciclo envia de novo (é seguro, porque o merge é idempotente);
   - `disconnectBind()`: remove o código; o histórico local permanece.
3. Testes (`testDb` e um servidor de bind falso **em memória** que usa o `mergeBindData` real do core):
   - reabrir não muda o `opened_at`;
   - dois aparelhos falsos convergem para o mesmo histórico;
   - repetir o envio (simulando uma falha depois do POST) não altera o resultado;
   - offline: os pendentes ficam marcados;
   - código inválido devolve `not_found` sem lançar;
   - `isRead` passa a ser verdadeiro para um capítulo lido em outro aparelho depois do sync.

## Fim
- `pnpm --filter @manga/mobile test` passa.

## Arquivos
- Criar: `apps/mobile/src/history/repo.ts`, `apps/mobile/src/sync/bind.ts`, `apps/mobile/src/history/__tests__/repo.test.ts`, `apps/mobile/src/sync/__tests__/bind.test.ts`

## Fora do escopo
A tela de conectar o bind (M4-18). A posição de página (fora da v1).

## Commit
`Add local reading history and bind sync engine`
