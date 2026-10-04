# M2-07 — Mover as regras do formato da biblioteca para o core

**Marco:** 1.2.0 · **Depende de:** M2-03, M2-05

## Objetivo
Mover para `@manga/core`, como funções puras, as regras que definem "o formato da biblioteca", para que o servidor e as fontes locais do app as apliquem de forma idêntica: número do capítulo, escolha entre pastas duplicadas, filtro e ordenação de imagens, parse do `.metadata`, normalização de categorias e o mapa de categorias.

## Contexto mínimo
Origem, em `apps/server/src/`:
- `utils/chapterDir.server.ts`: `resolveChapterDir(titlePath, chapterNumber)` faz `readdir` e escolhe, entre as entradas com `parseFloat(entry) === n`, a de mais arquivos.
- `app/api/read/[title]/route.ts`: monta a lista de capítulos agrupando por `parseFloat`, ignorando `NaN`, escolhendo o duplicado com mais arquivos e ordenando numericamente.
- `app/api/read/[title]/[chapter]/route.ts` e `[index]/route.ts` (e a rota `thumb`): filtram com `mime.getType(file)?.startsWith('image/')` e ordenam (nome puramente numérico primeiro, por valor; depois `localeCompare`).
- `services/metadata.ts`: `parseMetadataFile(content)`, `MetadataContent`, `EMPTY_METADATA`, `buildCategoryMap` (sobre `TitleInfo[]`) e `getCategories`.
- `utils/categories.ts`: `normalizeCategory` e aliases (já é "client-safe", sem `fs`).

## Início
- Testes de M2-03 passando.

## Meio
1. `packages/core/src/library/chapters.ts`:
   - `chapterNumber(name: string): number | null`, com a mesma semântica de `parseFloat`; `NaN` vira `null`;
   - `pickChapterDirs(entries: { name: string; fileCount: number }[]): Map<number, string>`, com o critério de desempate atual;
   - `sortedChapterNumbers(map)`.
2. `packages/core/src/library/images.ts`: `isImageFile(name)`, `compareImageNames(a, b)` e `sortImageFiles(names)`. Para a detecção de imagem, adicionar a dependência `mime` ao core (é JS puro) e usar `mime.getType` exatamente como hoje. Extrair o nome sem extensão sem usar `path`: tirar o último `.ext`.
3. `packages/core/src/library/metadata.ts`: `MetadataContent`, `EMPTY_METADATA` e `parseMetadataFile` (copiados).
4. `packages/core/src/library/categories.ts`: o conteúdo de `utils/categories.ts` e um `buildCategoryMap(titles: { name; modifiedAt; caps; categories }[])` puro, com o corpo atual sem o `cache()`.
5. Testes unitários em `packages/core/src/library/*.test.ts`, inclusive `566`/`0566`, `1.5`, `extras`, `10.jpg` depois de `2.jpg`, `notes.txt` ignorado, valor com `=` no metadata e aliases de categoria.
6. Servidor: substituir as cópias locais por imports do core. `resolveChapterDir` continua em `chapterDir.server.ts` (faz I/O), mas delega a escolha a `pickChapterDirs`. `services/metadata.ts` mantém `readMetadata`, `getAllTitles` e o `cache()`, e delega o parse e o `buildCategoryMap` ao core. `utils/categories.ts` vira re-export do core.
7. Build e smoke (porta 3994 contra a 3993).

## Fim
- `pnpm test` passa **sem atualizar snapshots**.
- `grep -rn "localeCompare" apps/server/src/app/api` não encontra nada: a ordenação vem só do core.
- O smoke sai com código 0.

## Arquivos
- Criar: `packages/core/src/library/{chapters,images,metadata,categories}.ts` e os respectivos `*.test.ts`
- Modificar: `packages/core/src/index.ts`, `packages/core/package.json`, `apps/server/src/utils/chapterDir.server.ts`, `apps/server/src/utils/categories.ts`, `apps/server/src/services/metadata.ts`, `apps/server/src/app/api/read/[title]/route.ts`, `apps/server/src/app/api/read/[title]/[chapter]/route.ts`, `apps/server/src/app/api/read/[title]/[chapter]/[index]/route.ts`, `apps/server/src/app/api/read/[title]/[chapter]/thumb/route.ts`

## Fora do escopo
Scanner e adapter de filesystem (M2-08). As rotas `xl` (deixar como estão).

## Commit
`Move library format rules into @manga/core`
