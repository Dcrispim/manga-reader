# M2-06 — Mover a lógica de bind/history para o core

**Marco:** 1.2.0 · **Depende de:** M2-03, M2-04, M2-05

## Objetivo
`mergeBindData`, `buildDeltaPayload`, `getLatestChapter` e os tipos `TitleHistory`/`BindPayload`/`BindData` passam a viver em `@manga/core`. O servidor importa de lá, com o comportamento idêntico garantido pelos testes de M2-03 e M2-04.

## Contexto mínimo
- Origem: `apps/server/src/utils/bind.ts` e `apps/server/src/utils/history.ts`. Eles misturam lógica pura com acesso ao `localStorage` (`getLastSync`, `setLastSync`, `saveToHistory`, `getHistory`, `setHistory`, `getChapters`, `setChapters`). **Só a lógica pura vai para o core.**
- Quem importa esses arquivos (não precisa mudar se os re-exports forem mantidos): `app/api/bind/route.ts`, `app/api/bind/[code]/route.ts`, `components/SidebarDrawer/Connect.tsx`, `components/home/Home.tsx`, `components/home/ContinueReading.tsx`, `components/GridView.tsx`, `app/read/[title]/page.tsx`, `app/read/[title]/next/page.tsx`, `app/read/[title]/[chapter]/chapter-reader-context.tsx`, `app/read/[title]/[chapter]/handle-keyboard.tsx`.
- O app também vai precisar de uma versão pura do `saveToHistory`.

## Início
- Testes de M2-03 e M2-04 passando.

## Meio
1. `packages/core/src/sync/history.ts`: `TitleHistory`, `normalizeEntry` e `getLatestChapter` (copiados sem mudança), mais a nova função pura `recordChapterOpen(history: Record<string, TitleHistory>, title, chapter, now: number): Record<string, TitleHistory>`, com **exatamente** a semântica do `saveToHistory` atual, mas sem efeitos colaterais e sem mutar a entrada.
2. `packages/core/src/sync/bind.ts`: `BindPayload`, `BindData`, `buildDeltaPayload` e `mergeBindData` (copiados sem mudança, importando de `./history`).
3. `packages/core/src/index.ts`: exportar tudo.
4. Mover `bind.test.ts` e `history.test.ts` de `apps/server/src/utils/` para `packages/core/src/sync/`, ajustando os imports. Acrescentar testes de `recordChapterOpen`: primeira abertura grava o timestamp; reabertura não regrava; no máximo 5 em `history`; `lastRead` = máximo; a entrada original não é mutada.
5. Em `apps/server/src/utils/history.ts`: re-exportar do core os tipos, `getLatestChapter` e `normalizeEntry` (se for usado); reescrever `saveToHistory` como `setHistory(recordChapterOpen(getHistory(), title, chapter, Date.now()))`. As funções de `localStorage` ficam ali.
6. Em `apps/server/src/utils/bind.ts`: re-exportar do core os tipos, `buildDeltaPayload` e `mergeBindData`. `BIND_CODE_KEY`, `BIND_LAST_SYNC_KEY`, `getLastSync` e `setLastSync` ficam.
7. `pnpm --filter @manga/server build` e o smoke no host (porta 3994) contra o 3993.

## Fim
- `pnpm test` na raiz passa (core e server). Os snapshots de `bind.test.ts` em `apps/server/test/routes/` continuam **sem atualização**: rodar com `vitest run` sem `-u`.
- `grep -n "function mergeBindData\|function buildDeltaPayload\|function getLatestChapter" -r apps/server/src` não encontra nada.
- O build passa e o smoke sai com código 0.

## Arquivos
- Criar: `packages/core/src/sync/{history.ts,bind.ts,history.test.ts,bind.test.ts}`
- Modificar: `packages/core/src/index.ts`, `apps/server/src/utils/history.ts`, `apps/server/src/utils/bind.ts`
- Remover: `apps/server/src/utils/{bind,history}.test.ts` (foram movidos)

## Fora do escopo
Mudar a semântica do merge.

## Commit
`Move bind merge and history logic into @manga/core`
