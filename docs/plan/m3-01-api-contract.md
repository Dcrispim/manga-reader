# M3-01 — Pacote `@manga/api-contract` com os schemas zod

**Marco:** 1.3.0 (APIs novas) · **Depende de:** marco 1.2.0 concluído

## Objetivo
Criar o pacote que define, com zod, o formato de cada resposta da API que o app consome. Os schemas são validados contra respostas reais geradas pelos testes do servidor.

## Contexto mínimo
Formatos atuais, das rotas GET em `apps/server/src/app/api/`:
- `/api/read/:title` → `{ chapters: string[], modified: Record<string, number> }`, mais os campos que existirem (conferir no snapshot de `apps/server/test/routes/__snapshots__/read.test.ts.snap`);
- `/api/read/:title/:chapter` → `{ images: string[] }` (caminhos relativos `/api/read/...`);
- `/api/read/:title/:chapter/xl` → `{ images: string[] }`, ou 404;
- `/api/read/:title/:chapter/upscale`: GET e POST → `{ status: 'pending'|'processing'|'done'|'error'|null, alreadyUpscaled?: boolean }`, ou `{ error }` com 404;
- `/api/metadata/:title` → `MetadataContent & { thumbSource: 'curated'|'crop' }` (`MetadataContent` está em `@manga/core`);
- `/api/bind/:code`: GET e POST → `BindData` (em `@manga/core`); POST `/api/bind` → `BindData`;
- respostas de erro do servidor: `{ error: string }` (ou `{ message }` vindo do `fetchData`).

Os novos endpoints (implementados em M3-02 e M3-03) também têm o schema definido **aqui**:
- `Health = { serverId?: string, version: string, features: string[] }`;
- `Catalog = { serverTime: number, since: number, full: boolean, allTitleNames: string[], titles: CatalogTitle[] }`;
- `CatalogTitle = { name, mtimeMs, metadata: MetadataContent, categories: string[] /* normalizadas */, thumb: { url: string, version: string } | null, chapters: { id: string, number: number, pages: number, mtimeMs: number }[] }`.

## Início
- Marco 1.2.0 mergeado; branch `milestone/1.3.0` criada.

## Meio
1. `packages/api-contract/package.json` (`@manga/api-contract`, exports `./src/index.ts`, dependências `zod` e `@manga/core: workspace:*`, scripts `test`, `typecheck` e `lint`), além de `tsconfig.json` e `eslint.config.mjs` com a mesma regra de imports proibidos do core.
2. `src/schemas.ts`: um schema por resposta, com `z.infer` exportado como tipo. Os schemas devem ser **tolerantes a campos extras** (`.passthrough()` ou `.strip()`, mas nunca `.strict()`): o app não pode quebrar quando o servidor ganhar um campo novo.
3. `src/paths.ts`: construtores de URL tipados (`paths.chapter(title, chapter)` etc.), com `encodeURIComponent` em cada segmento, e `resolveUrl(base, relative)`. As rotas devolvem caminhos relativos e o app precisa prefixar o endereço configurado.
4. `src/index.ts`: exportar tudo.
5. Testes: para cada snapshot JSON de `apps/server/test/routes/__snapshots__`, extrair os casos para fixtures em `packages/api-contract/test/fixtures/*.json` (copiados à mão a partir do snapshot) e validar com `safeParse`. Incluir casos negativos: `images` como número falha; campo extra passa.
6. Adicionar `@manga/api-contract` a `transpilePackages` em `apps/server/next.config.ts`.

## Fim
- `pnpm --filter @manga/api-contract test typecheck lint` passa.
- `pnpm test` na raiz passa.

## Arquivos
- Criar: `packages/api-contract/{package.json,tsconfig.json,eslint.config.mjs,src/index.ts,src/schemas.ts,src/paths.ts,src/schemas.test.ts,src/paths.test.ts,test/fixtures/*.json}`
- Modificar: `apps/server/next.config.ts`, `pnpm-lock.yaml`

## Fora do escopo
Implementar `/health` e `/catalog`.

## Commit
`Add @manga/api-contract with zod schemas for the API`
