# M4-14 — Shell da UI e telas de catálogo (início, categorias, título e busca)

**Marco:** mobile v1 · **Depende de:** M4-06, M4-12, M4-13

## Objetivo
Criar as telas de navegação do catálogo, lendo **somente** do SQLite com live queries, com layout responsivo para celular e tablet, error boundary por tela, placeholders limpos e busca local.

## Contexto mínimo
- Dados no SQLite:
  - `titles(name, metadata_json, categories_json, thumb_path, updated_at)`;
  - `chapter_sources(title, chapter, source_id, pages)`;
  - `downloads(title, chapter)`;
  - `transient_pages`;
  - `history` (para "continuar lendo" e "lido");
  - `jobs` (para o estado "na fila").
- Live queries: `useLiveQuery` de `drizzle-orm/expo-sqlite` (exige `enableChangeListener: true`, já presente em M4-03).
- As categorias especiais do web (Todos, Recentes, Menos de 100, Mais de 200/500/1000) vêm de `buildCategoryMap` em `@manga/core`, aplicado sobre `titles`. Para `caps`, usar a contagem de capítulos da tabela `chapter_sources`.
- Placeholder de capa: as iniciais do título sobre uma cor derivada do nome (hash para HSL). Usar o placeholder sempre que `thumb_path` for nulo ou a imagem falhar (`onError` do `expo-image`).
- Metadados ausentes: os campos vazios simplesmente não aparecem.
- Responsivo: o número de colunas da grade é `floor(largura / 130 dp)` (dá cerca de 3 no celular e 6 a 8 no tablet).
- Busca: `fuse.js` sobre nome, autor e categorias, em memória e construída a partir de `titles`. Funciona offline.
- Indicador de status: `ServerStatusPill` (M4-05) no header.
- Nenhuma tela chama a rede diretamente. A exceção é o modo degradado: abrir um título chama `syncTitleOnDemand` (M4-06) em segundo plano, e a tela se atualiza sozinha pela live query.

## Início
- M4-13 commitado.

## Meio
1. `apps/mobile/src/ui/ErrorBoundary.tsx`: mostra "Algo deu errado nesta tela" com os botões "Voltar" e "Tentar de novo", e registra no `diag_log`. Envolver cada rota com ele (um wrapper em `app/_layout.tsx` ou em cada tela).
2. `apps/mobile/src/ui/{TitleCover.tsx,TitleGrid.tsx,Placeholder.tsx}`.
3. Rotas (expo-router):
   - `app/index.tsx` (Início): "Continuar lendo" (títulos por `lastRead`, com o capítulo de `latestChapter`), "Baixados" e um carrossel por categoria. Se não houver dados, um estado vazio: "Nenhum título ainda. Configure o servidor ou adicione uma pasta local".
   - `app/category/[id].tsx`: a grade da categoria.
   - `app/title/[name].tsx`: capa, metadados, a lista de capítulos (do maior para o menor, com toggle de ordem) e, por capítulo, um badge de estado: `local`, `baixado`, `em cache`, `na fila (x/y)`, `aguardando espaço` ou nenhum. Ações por capítulo: "Baixar" ou "Baixar quando disponível" (`enqueue`), e "Remover download".
   - `app/search.tsx`: busca com debounce de 150 ms.
4. `apps/mobile/src/catalog/queries.ts`: as live queries e funções puras de montagem, testáveis.
5. Testes (jest-expo):
   - funções de `queries.ts` com `testDb` (estado dos capítulos, continuar lendo, mapeamento de categorias);
   - a cor do placeholder é estável para o mesmo nome;
   - render do `ErrorBoundary` capturando o erro de um filho.

## Fim
- Testes passando.
- No emulador, com o servidor online: o Início, as categorias, um título e a busca mostram dados reais.
- Com o servidor offline (parar o container efêmero ou apontar para uma porta errada) e o app reaberto: as mesmas telas abrem com os dados do SQLite, com o pill de status cinza e **nenhuma** tela de erro.
- No AVD `manga_tablet`, a grade usa mais colunas.

## Arquivos
- Criar: `apps/mobile/app/{index.tsx,category/[id].tsx,title/[name].tsx,search.tsx}`, `apps/mobile/src/ui/{ErrorBoundary,TitleCover,TitleGrid,Placeholder}.tsx`, `apps/mobile/src/catalog/queries.ts`, `apps/mobile/src/catalog/__tests__/queries.test.ts`, `apps/mobile/src/ui/__tests__/*.test.tsx`
- Modificar: `apps/mobile/app/_layout.tsx`, `apps/mobile/package.json` (fuse.js, expo-image)

## Fora do escopo
Leitor (M4-15). Tela de armazenamento (M4-18).

## Commit
`Add catalog, title and search screens backed by live queries`
