# M3-03 — `GET /api/catalog?since=` incremental

**Marco:** 1.3.0 · **Depende de:** M3-01, M3-02

## Objetivo
Criar o endpoint que entrega ao app, numa única requisição, tudo o que mudou na biblioteca desde um instante: metadados, categorias normalizadas, capítulos com a contagem de páginas e a versão da capa. Com ele, o app mantém um catálogo completo offline sem fazer centenas de requisições.

## Contexto mínimo
- O scanner já existe: `scanLibrary(fs, root, { since })` em `@manga/core` (M2-08), com o adapter Node em `apps/server/src/services/nodeFs.server.ts`. Ele só varre títulos cujo mtime da pasta, do `.meta/<t>.metadata` ou do `.thumb/<t>.jpg` seja maior que `since`, e sempre devolve `allTitleNames`.
- O schema `Catalog`/`CatalogTitle` está em `@manga/api-contract` (M3-01).
- A normalização de categorias usa `normalizeCategory` do `@manga/core`.
- URL da capa: `/api/read/<título>/01/thumb` (rota existente, que já faz o fallback). A `version` da capa é `String(thumbMtimeMs ?? <mtime da pasta do capítulo 01>)`, ou seja, muda quando a capa muda.
- Escala: até 200 títulos × 400 capítulos. A primeira chamada (`since=0`) lista ~80 mil diretórios. As seguintes fazem só ~600 `stat`s.

## Início
- M3-02 commitado.

## Meio
1. `apps/server/src/services/catalog.server.ts`: `buildCatalog(since: number)`, que chama `scanLibrary` com o `nodeFs` e converte para `Catalog`. `serverTime` é capturado **antes** da varredura, para que uma mudança feita durante a varredura apareça na próxima. Manter um cache em memória `Map<titleName, { key: string; value: CatalogTitle }>`, com `key` igual aos mtimes concatenados, para não recontar páginas de títulos que não mudaram quando dois clientes pedem `since=0`.
2. `apps/server/src/app/api/catalog/route.ts`: `GET`, com `since` vindo de `?since=` (inválido ou ausente vale 0), `dynamic = 'force-dynamic'` e `Cache-Control: no-store`. Erro inesperado devolve 500 com `{ error }`. Títulos individuais com erro **não** derrubam a resposta, porque o scanner já os isola.
3. `features.server.ts`: `FEATURES = ['catalog']`.
4. Testes (`apps/server/test/routes/catalog.test.ts`, com `makeLibrary`):
   - `since=0`: todos os títulos visíveis; `Alpha` com o capítulo `0566` (4 páginas); categorias de `Beta` normalizadas; a resposta valida com o schema;
   - `since=serverTime` da resposta anterior: `titles` vazio e `allTitleNames` completo;
   - criar uma pasta de capítulo em `Beta` (com o mtime ajustado via `fs.utimes` para depois de `since`): só `Beta` volta;
   - remover um título: ele some de `allTitleNames`;
   - alterar o `.metadata` de `Beta`: `Beta` volta.
5. Teste de desempenho (`apps/server/test/perf/catalog.perf.test.ts`, só roda com `PERF=1`): gerar uma biblioteca com 200 × 400 capítulos × 15 arquivos **vazios** `.jpg` (a contagem usa a extensão, não o conteúdo), medir `since=0` e `since=serverTime`, e imprimir os tempos. **Metas:** incremental < 300 ms; completo < 60 s. Registrar os números medidos em `docs/adr/0005-catalogo-incremental.md`.

## Fim
- `pnpm --filter @manga/server test` passa.
- `PERF=1 pnpm --filter @manga/server exec vitest run test/perf` cumpre as metas.
- O tamanho da resposta completa na escala-alvo, com gzip, fica registrado no ADR (`curl -s --compressed -o /dev/null -w '%{size_download}'`).

## Arquivos
- Criar: `apps/server/src/services/catalog.server.ts`, `apps/server/src/app/api/catalog/route.ts`, `apps/server/test/routes/catalog.test.ts`, `apps/server/test/perf/catalog.perf.test.ts`
- Modificar: `apps/server/src/services/features.server.ts`, `docs/adr/0005-catalogo-incremental.md`

## Fora do escopo
Paginação da resposta. Detectar páginas novas dentro de um capítulo existente (limitação documentada no scanner).

## Commit
`Add incremental /api/catalog endpoint`
