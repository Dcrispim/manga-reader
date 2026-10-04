# M4-08 — Armazenamento de downloads (gravação atômica, evicção e reconciliação)

**Marco:** mobile v1 · **Depende de:** M4-06 (`FileStore`), M4-07 (política)

## Objetivo
Criar o repositório que grava capítulos baixados no disco do app de forma atômica, aplica a política de espaço depois de cada gravação e reconcilia o disco com o SQLite na inicialização.

## Contexto mínimo
- Local: `${documentDirectory}/downloads/<hashTitle>/<chapter>/<NNN>.<ext>` (o `documentDirectory` não é limpo pelo sistema). O hash do título vem de `apps/mobile/src/catalog/hash.ts`.
- Escrita atômica: as páginas são baixadas em `<chapter>.tmp/`. Ao completar, o diretório é renomeado para `<chapter>/` e só então a linha em `downloads` é inserida (`bytes` = soma real dos arquivos). Um capítulo pela metade nunca aparece como baixado.
- Política (`@manga/core`): `planEviction(chapters, limits, protectedIds)`. `isRead` = existe alguma linha em `history` para `(title, chapter)`. Os limites vêm dos settings (`space.maxPerTitle`, `space.maxGlobal`, `space.maxBytes`, `space.minFreeBytes`), com padrões em `DEFAULT_LIMITS`.
- `protectedIds` = o recém-salvo mais o capítulo aberto no leitor (setting em memória `reader.openChapterId`, exposto por um pequeno store).
- `FileStore` em `apps/mobile/src/storage/files.ts`.

## Início
- M4-06 e M4-07 commitados.

## Meio
1. `apps/mobile/src/storage/downloads.ts`:
   - `chapterTmpDir(title, chapter)` e `chapterDir(title, chapter)`;
   - `commitChapter(db, files, { title, chapter, pages, quality })`: renomeia o tmp para o definitivo, mede os bytes, insere ou substitui em `downloads` com `saved_at = now` e chama `enforceSpace`;
   - `replaceChapterImages(...)`, usado pelo upgrade high-res: troca as páginas atomicamente (o tmp `.xl` vira o definitivo) **sem** mudar `saved_at` e sem rodar a evicção. Se o capítulo não existir mais, devolve `false` e apaga o tmp;
   - `deleteChapter`, `deleteTitle` e `deleteAll`;
   - `enforceSpace(db, files, protectedIds)`: aplica `planEviction` e registra cada evicção no `diag_log` (`scope='space'`);
   - `reconcile(db, files)`: diretórios sem linha são apagados; linhas sem diretório são apagadas; `*.tmp` **não** são apagados (o download pode ser retomado), mas os que não têm job correspondente em `jobs` são;
   - `listDownloadedPages(title, chapter)`: caminhos ordenados das páginas.
2. Chamar `reconcile` na inicialização, depois das migrações (`app/_layout.tsx`), sem bloquear a UI.
3. Testes com `testDb` e `memoryFileStore`:
   - commit atômico;
   - tmp incompleto não aparece em `downloads`;
   - evicção por título, global e por bytes, com lidos saindo primeiro;
   - o protegido não é removido;
   - `replaceChapterImages` preserva o `saved_at`;
   - `replaceChapterImages` de um capítulo apagado devolve `false`;
   - reconcile nos três casos.

## Fim
- `pnpm --filter @manga/mobile test` passa.

## Arquivos
- Criar: `apps/mobile/src/storage/downloads.ts`, `apps/mobile/src/storage/__tests__/downloads.test.ts`, `apps/mobile/src/reader/openChapter.ts` (store do capítulo aberto)
- Modificar: `apps/mobile/app/_layout.tsx`

## Fora do escopo
Baixar da rede (M4-10). Cache transitório (M4-09).

## Commit
`Add atomic download storage with space enforcement and reconciliation`
