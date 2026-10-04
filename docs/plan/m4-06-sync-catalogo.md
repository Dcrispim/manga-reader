# M4-06 — Sync engine do catálogo

**Marco:** mobile v1 · **Depende de:** M4-05

## Objetivo
Manter as tabelas `titles` e `chapter_sources` (com `source_id='server'`) e as capas locais em dia com o servidor, de forma incremental, sem nunca lançar exceções, e com um modo degradado para servidores sem `/api/catalog`.

## Contexto mínimo
- `GET /api/catalog?since=<ms>` → `{ serverTime, since, full, allTitleNames[], titles: [{ name, mtimeMs, metadata, categories[], thumb: { url, version } | null, chapters: [{ id, number, pages, mtimeMs }] }] }` (schema `Catalog` em `@manga/api-contract`).
- Cursor: setting `catalog.since` (padrão 0). Só avança depois de **todas** as gravações daquela resposta terem sido aplicadas numa transação.
- Remoções: títulos ausentes de `allTitleNames` perdem as linhas `chapter_sources` com `source_id='server'`. A linha em `titles` só é apagada se o título também não tiver fonte local nem download.
- Capas: arquivo em `${documentDirectory}/thumbs/<hash do nome>.jpg`, baixado só quando `thumb.version` diferir de `titles.thumb_version`. Uma falha mantém a capa anterior.
- No `chapter_sources`, `chapter` é o número canônico (`String(number)`, ex. `"566"`) e `location` é o `id` da pasta no servidor (ex. `"0566"`). As URLs de leitura usam o **número** (`/api/read/<t>/<número>`), como no web.
- Modo degradado (o servidor não tem `catalog` em `features`): `syncTitleOnDemand(title)` usa `/api/read/:title` + `/api/metadata/:title`, e é chamado quando a tela do título é aberta (M4-14). `pages` fica `null` (projeção cega).
- Escala: a primeira sincronização pode trazer 200 títulos e 80 mil capítulos. Gravar em lotes (por título, numa transação), cedendo o event loop entre lotes.

## Início
- M4-05 commitado.

## Meio
1. `apps/mobile/src/storage/files.ts`: uma interface `FileStore` mínima (`download(url, dest): Promise<{ ok: boolean; bytes: number }>`, `move`, `remove`, `exists`, `size`, `listDir`, `makeDir`, `freeDiskBytes`), a implementação `expoFileStore` com a API atual do `expo-file-system` e um `memoryFileStore` para testes. (Esta interface é reutilizada em M4-08 a M4-10.)
2. `apps/mobile/src/sync/catalog.ts`:
   - `syncCatalog({ db, client, files, now }): Promise<{ changed: number } | { skipped: reason }>`, que roda só com o status `online` e com a feature `catalog`;
   - `syncTitleOnDemand(...)`, para o modo degradado;
   - um lock em memória, para que duas chamadas simultâneas virem uma.
3. `apps/mobile/src/catalog/hash.ts`: um hash de nome estável (FNV-1a) para nomes de arquivo.
4. Testes com `testDb`, cliente falso e `memoryFileStore`:
   - sincronização completa inicial;
   - incremental sem mudanças: nenhuma escrita, e o cursor avança para o `serverTime`;
   - um título removido do servidor com download local: a linha em `titles` permanece;
   - capa com a mesma versão: não baixa de novo;
   - download da capa falha: catálogo atualizado e capa antiga mantida;
   - resposta `invalid` (fora do schema): nada é gravado e o cursor não avança; falha ao gravar um título no meio do lote: os títulos anteriores ficam gravados e o cursor **não** avança (a próxima sincronização refaz, o que é idempotente);
   - modo degradado.

## Fim
- Testes passando.
- No emulador, contra o servidor (o efêmero de teste 3994 com 1.3.0, ou o estável se ele já tiver sido atualizado pelo usuário): depois de abrir o app, `adb shell run-as com.dcrispim.mangareader sqlite3 ...`, ou uma tela de debug temporária, mostra o número de títulos igual a `/api/list`.

## Arquivos
- Criar: `apps/mobile/src/storage/files.ts`, `apps/mobile/src/storage/memoryFileStore.ts`, `apps/mobile/src/sync/catalog.ts`, `apps/mobile/src/catalog/hash.ts`, `apps/mobile/src/sync/__tests__/catalog.test.ts`

## Fora do escopo
Telas (M4-14). Agendamento (M4-13).

## Commit
`Add the incremental catalog sync engine`
