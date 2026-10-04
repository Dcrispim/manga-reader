# M2-04 — Testes de caracterização de bind/history (lógica pura)

**Marco:** 1.2.0 · **Depende de:** M2-02

## Objetivo
Cobrir com testes unitários o comportamento atual de `mergeBindData`, `buildDeltaPayload` e `getLatestChapter`, a lógica de sincronização de progresso que o app e o web precisam compartilhar sem nenhuma divergência.

## Contexto mínimo
- `apps/server/src/utils/history.ts`: `TitleHistory = { lastRead: number|null, history: string[], openedAt: Record<string, number> }`. O `getLatestChapter(entry)` devolve o capítulo com maior `openedAt`, ou `null`. O `saveToHistory` (que usa `localStorage`) grava `openedAt[chapter]` **só na primeira vez**, mantém os últimos 5 em `history` e recalcula `lastRead` como o máximo de `openedAt`.
- `apps/server/src/utils/bind.ts`:
  - `buildDeltaPayload(full, since)` inclui apenas os títulos com algum `openedAt > since` (e só esses timestamps), mais `chapters` inteiro;
  - `mergeBindData(local, remote)` une os `openedAt` por título pelo **máximo**, junta os `history`, ordena por `openedAt` e mantém os 5 últimos;
  - nesse merge, `lastRead` = máximo dos timestamps (ou o fallback legado), e `chapters[title]` = `getLatestChapter`, com fallback legado quando `remote.lastRead > local.lastRead`.
- `history.ts` não tem `"use client"` porque `getLatestChapter` roda no servidor.

## Início
- M2-02 commitado.

## Meio
1. `apps/server/src/utils/bind.test.ts`:
   - merge de títulos disjuntos (a união);
   - merge com o mesmo capítulo e timestamps diferentes (vence o máximo);
   - `history` com mais de 5 itens após o merge (ficam os 5 mais recentes por `openedAt`);
   - `chapters[title]` apontando para o capítulo de maior `openedAt` mesclado;
   - fallback legado (entradas sem `openedAt`);
   - **propriedades**, em loop sobre ~200 casos gerados com um PRNG de seed fixa (sem dependência nova):
     - idempotência: `merge(a, a)` tem o mesmo `history`/`openedAt` que `a` normalizado;
     - comutatividade de `openedAt` e `lastRead`: `merge(a,b)` e `merge(b,a)` dão os mesmos `openedAt` e `lastRead` (o campo `chapters` legado pode diferir — documentar);
     - associatividade de `openedAt`;
   - `buildDeltaPayload`: inclui só os timestamps maiores que `since`; título sem nenhum fica de fora; `chapters` vai sempre inteiro.
2. `apps/server/src/utils/history.test.ts`: `getLatestChapter` com vazio, com `undefined` e com empate (documentar qual vence hoje).
3. Se uma propriedade **falhar** no código atual, não corrigir: transformar o caso em teste de caracterização do comportamento real, com um comentário explicando, e listar isso na mensagem de commit.

## Fim
- `pnpm --filter @manga/server test` passa.
- `bind.ts` com cobertura de linhas ≥ 90% (`vitest run --coverage` com `@vitest/coverage-v8`, que pode ser adicionado como devDependency).

## Arquivos
- Criar: `apps/server/src/utils/bind.test.ts`, `apps/server/src/utils/history.test.ts`
- Modificar: `apps/server/package.json` (se adicionar a cobertura)

## Fora do escopo
Mover código (M2-06).

## Commit
`Add unit and property tests for bind merge and history`
