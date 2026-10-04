# M4-09 — Cache transitório de leitura e resolvedor de páginas

**Marco:** mobile v1 · **Depende de:** M4-08

## Objetivo
Dado `(title, chapter)`, devolver a lista de páginas com a melhor origem disponível para cada uma, e guardar o que for lido online num cache LRU de 300 MB, separado dos downloads. "Baixar" um capítulo que já está inteiro no cache vira mover os arquivos, sem rede.

## Contexto mínimo
- Prioridade de origem: **fonte local (SAF)** > **download** > **cache transitório** > **servidor**. As fontes SAF chegam em M4-17. Aqui, deixar um ponto de extensão `localPageProvider` que devolve `null` por enquanto.
- Cache transitório: `${cacheDirectory}/transient/<hashTitle>/<chapter>/<NNN>.<ext>`. O Android pode limpar o `cacheDirectory`, o que é aceitável. A tabela é `transient_pages(title, chapter, page, path, bytes, last_access)`. O teto vem do setting `space.transientMaxBytes` (padrão 300 MB) e a evicção usa `planLruEviction` do `@manga/core`, protegendo o capítulo aberto.
- Lista de páginas no servidor: `GET /api/read/<t>/<número>` → `{ images: string[] }` (relativas). Imagem: `client.url(relativa)`.
- A versão xl, se o usuário escolher "upscaled" no leitor, vem de `GET /api/read/<t>/<n>/xl` → `{ images }`, ou 404 se não existir.
- `FileStore.download(url, dest)` e o cliente `createClient` (M4-04).

## Início
- M4-08 commitado.

## Meio
1. `apps/mobile/src/reader/resolve.ts`:
   - `type PageSource = { kind: 'local' | 'download' | 'transient' | 'remote'; uri: string; index: number }`;
   - `resolveChapterPages({ db, client, files, title, chapter, quality }): Promise<{ pages: PageSource[] } | { unavailable: true }>`, que tenta a fonte local (ponto de extensão), depois o download (`listDownloadedPages`), depois o cache transitório completo e por fim a lista do servidor (`remote`, com a URL absoluta). Para o servidor offline com o capítulo nem baixado nem em cache, devolve `unavailable`. Se o cache tiver só parte do capítulo e o servidor estiver offline, também é `unavailable` (não mostrar o capítulo pela metade).
2. `apps/mobile/src/storage/transient.ts`:
   - `fetchToTransient(...)`: baixa uma página remota para o cache, registra, atualiza o `last_access` e roda a evicção LRU. Devolve o caminho local ou `null`, nunca lança;
   - `touch(title, chapter)`, `clearTransient()`, `reconcileTransient()` (arquivos sem linha e linhas sem arquivo, como no M4-08) e `isChapterFullyCached(title, chapter, pageCount)`;
   - `promoteToDownload(title, chapter)`: se o capítulo estiver completo no cache, **move** os arquivos para o tmp de download e chama `commitChapter`, e devolve `true`.
3. Chamar `reconcileTransient` na inicialização, junto com o `reconcile` do M4-08.
4. Testes (`testDb`, `memoryFileStore`, cliente falso):
   - prioridade download > transient > remote;
   - offline sem nada: `unavailable`;
   - offline com cache parcial: `unavailable`;
   - LRU respeitando os 300 MB e protegendo o capítulo aberto;
   - `promoteToDownload` move sem rede;
   - falha de download de página devolve `null` sem lançar.

## Fim
- `pnpm --filter @manga/mobile test` passa.

## Arquivos
- Criar: `apps/mobile/src/reader/resolve.ts`, `apps/mobile/src/storage/transient.ts`, `apps/mobile/src/reader/__tests__/resolve.test.ts`, `apps/mobile/src/storage/__tests__/transient.test.ts`
- Modificar: `apps/mobile/app/_layout.tsx`

## Fora do escopo
UI do leitor (M4-15). Fila de downloads (M4-10).

## Commit
`Add the transient read cache and page source resolver`
