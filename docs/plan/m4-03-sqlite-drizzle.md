# M4-03 — Banco local (expo-sqlite + drizzle) e schema completo

**Marco:** mobile v1 · **Depende de:** M4-02

## Objetivo
Definir **todo** o schema SQLite do app num lugar só, com migrações aplicadas na inicialização e testável em Node. O SQLite é a fonte de verdade da UI.

## Contexto mínimo
- Princípio: a UI só lê do SQLite (live queries do drizzle). As sync engines escrevem.
- O schema precisa servir a: configurações, catálogo (títulos, capítulos e as fontes de cada capítulo), downloads, cache transitório, fila de jobs, histórico e bind, fontes locais (SAF) e log de diagnóstico.
- Os testes rodam no Jest (Node), onde o `expo-sqlite` não existe. Por isso os repositórios recebem um `Db` genérico do drizzle (modo síncrono), e os testes usam `drizzle-orm/better-sqlite3` com `:memory:`.

## Início
- M4-02 commitado.

## Meio
1. `npx expo install expo-sqlite`; `pnpm --filter @manga/mobile add drizzle-orm`; `pnpm --filter @manga/mobile add -D drizzle-kit better-sqlite3 @types/better-sqlite3 babel-plugin-inline-import`. Adicionar `better-sqlite3` ao `onlyBuiltDependencies` do workspace, se ainda não estiver.
2. `apps/mobile/src/db/schema.ts` (drizzle `sqlite-core`). Tabelas, com `title` sendo o nome do título:
   - `settings(key text pk, value text)`;
   - `sources(id text pk, kind text /* 'server' | 'saf' */, root text, label text, status text /* 'ok'|'unavailable'|'scanning' */, last_scan_at int, scan_cursor text null, ignored_json text)`. A linha `id='server'` é criada na migração;
   - `titles(name text pk, metadata_json text, categories_json text, thumb_version text null, thumb_path text null, server_mtime int null, updated_at int)`;
   - `chapter_sources(title text, chapter text /* número canônico como string, ex. "566" */, source_id text, location text /* id no servidor ou URI/caminho local */, pages int null, mtime_ms int, pk(title, chapter, source_id))`;
   - `downloads(title, chapter, dir text, pages int, bytes int, saved_at int, quality text /* 'original'|'xl' */, pk(title, chapter))`;
   - `transient_pages(title, chapter, page int, path text, bytes int, last_access int, pk(title, chapter, page))`;
   - `jobs(id int pk autoincrement, kind text /* 'download'|'upgrade' */, title, chapter, state text /* 'queued'|'running'|'paused'|'done'|'failed' */, pages_done int, pages_total int null, attempts int, next_attempt_at int, last_error text null, created_at int, unique(kind, title, chapter))`;
   - `history(title, chapter, opened_at int, pending int /* 1 = ainda não enviado ao bind */, pk(title, chapter))`;
   - `diag_log(id int pk autoincrement, at int, level text, scope text, message text)`.
   - Índices: `chapter_sources(title)`, `jobs(state, next_attempt_at)`, `transient_pages(last_access)` e `downloads(saved_at)`.
3. `drizzle.config.ts` (dialect `sqlite`, driver `expo`) e o script `"db:generate": "drizzle-kit generate"`. Gerar a migração inicial em `apps/mobile/drizzle/`.
4. `babel.config.js`: o plugin `inline-import` para `.sql`. `metro.config.js`: `sourceExts` incluindo `sql`.
5. `apps/mobile/src/db/client.ts`: abre `openDatabaseSync('manga.db', { enableChangeListener: true })`, cria o `drizzle(...)` com o schema e exporta `useMigrationsGate()`, que usa o `useMigrations` do drizzle e, em caso de falha, **não lança**: grava em `diag_log` e devolve o estado.
6. `apps/mobile/src/db/types.ts`: `export type Db = BaseSQLiteDatabase<'sync', any, typeof schema>`.
7. `apps/mobile/src/db/testDb.ts` (só para testes): cria um banco `better-sqlite3` em memória, aplica as migrações SQL de `drizzle/` e devolve `Db`.
8. `app/_layout.tsx`: enquanto as migrações não terminam, mostra um splash simples. Se falharem, mostra uma tela neutra com "Reiniciar" (sem stack trace).
9. Teste `src/db/__tests__/schema.test.ts`: as migrações aplicam; insere e lê uma linha de cada tabela; a linha `sources.id='server'` existe.

## Fim
- `pnpm --filter @manga/mobile test` passa.
- O app abre no emulador sem erro, e `adb logcat` não mostra exceção de migração.

## Arquivos
- Criar: `apps/mobile/src/db/{schema.ts,client.ts,types.ts,testDb.ts}`, `apps/mobile/drizzle/**`, `apps/mobile/drizzle.config.ts`, `apps/mobile/src/db/__tests__/schema.test.ts`
- Modificar: `apps/mobile/{package.json,babel.config.js,metro.config.js,app/_layout.tsx}`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`

## Fora do escopo
Repositórios e engines.

## Commit
`Add the local SQLite schema with drizzle migrations`
