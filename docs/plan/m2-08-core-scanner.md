# M2-08 — `FsAdapter` e scanner incremental no core

**Marco:** 1.2.0 · **Depende de:** M2-07

## Objetivo
Criar no core um scanner de biblioteca que funcione sobre qualquer filesystem (Node no servidor, SAF no app) através de um adapter, com modo incremental baseado em mtime. É a base do `/api/catalog` (M3-03) e das fontes locais do app (M4-19).

## Contexto mínimo
- As regras do formato já estão no core (`library/chapters.ts`, `images.ts`, `metadata.ts`), de M2-07.
- Na escala-alvo (200 títulos × 400 capítulos), uma varredura completa lista ~80 mil diretórios. A incremental só deve olhar o mtime da pasta de cada título, mais `.meta/<t>.metadata` e `.thumb/<t>.jpg`. Criar ou remover um capítulo altera o mtime da pasta do título; adicionar páginas dentro de um capítulo existente **não** altera, e essa limitação é aceita e documentada.
- O core não pode importar `fs` nem `path`. Caminhos são strings unidas com `/`.

## Início
- M2-07 commitado.

## Meio
1. `packages/core/src/library/fs.ts`:
   ```ts
   export type FsEntry = { name: string; isDirectory: boolean; mtimeMs: number; size: number }
   export interface FsAdapter {
     list(path: string): Promise<FsEntry[]>        // throws if path is missing
     stat(path: string): Promise<FsEntry | null>    // null if missing
     readText(path: string): Promise<string | null> // null if missing
   }
   export const joinPath = (...parts: string[]) => …
   ```
2. `packages/core/src/library/scan.ts`:
   - `type ChapterScan = { id: string /* nome da pasta escolhida */; number: number; pages: number; mtimeMs: number }`;
   - `type TitleScan = { name: string; mtimeMs: number; metaMtimeMs: number | null; thumbMtimeMs: number | null; metadata: MetadataContent; chapters: ChapterScan[]; ignored: string[] }`;
   - `scanTitle(fs, root, name): Promise<TitleScan>`, que aplica `pickChapterDirs` e conta as páginas com `isImageFile`;
   - `listTitles(fs, root)`: diretórios da raiz que não começam com `.`, com mtime, mais o mtime do `.meta` e do `.thumb` de cada um;
   - `scanLibrary(fs, root, opts: { since?: number; onProgress?(done, total); signal?: AbortSignal; concurrency?: number /* padrão 4 */ }): Promise<{ titles: TitleScan[]; allTitleNames: string[]; scannedAt: number }>`. Ela varre só os títulos em que `max(mtimeMs, metaMtimeMs, thumbMtimeMs) > since` (ou todos, se `since` for ausente ou 0), respeita o `signal` e nunca lança por causa de um título individual: um título com erro vai para `ignored` no resultado, com o motivo.
   - Comentário no topo explicando a limitação "páginas novas num capítulo existente".
3. `packages/core/src/library/memoryFs.ts`: um `FsAdapter` em memória para testes, construído a partir de uma árvore literal, com mtimes controláveis.
4. Testes em `scan.test.ts`: duplicados; ignorados; incremental (alterar o mtime de um título faz só ele voltar); `.meta` alterado faz o título voltar; `abort` interrompe; um título com erro de leitura não derruba os outros; `allTitleNames` sempre completo.
5. `apps/server/src/services/nodeFs.server.ts`: implementação de `FsAdapter` com `fs/promises`. Teste em `apps/server/test/nodeFs.test.ts`, que roda `scanLibrary` sobre `makeLibrary(DEFAULT_SPEC)` e confere que os capítulos de `Alpha` batem com o que a rota `/api/read/Alpha` devolve (mesmos ids, mesma ordem).

## Fim
- `pnpm test` passa.
- O teste de equivalência do passo 5 passa.

## Arquivos
- Criar: `packages/core/src/library/{fs,scan,memoryFs}.ts`, `packages/core/src/library/scan.test.ts`, `apps/server/src/services/nodeFs.server.ts`, `apps/server/test/nodeFs.test.ts`
- Modificar: `packages/core/src/index.ts`

## Fora do escopo
Usar o scanner em alguma rota (M3-03).

## Commit
`Add FsAdapter and incremental library scanner to @manga/core`
