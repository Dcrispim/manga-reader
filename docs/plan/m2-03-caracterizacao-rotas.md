# M2-03 — Testes de caracterização das rotas de leitura

**Marco:** 1.2.0 · **Depende de:** M2-02

## Objetivo
Congelar em testes o comportamento **atual** das rotas GET de leitura contra a biblioteca sintética, para que a extração de lógica nas etapas M2-06 e M2-07 prove que não mudou nada.

## Contexto mínimo
- Os route handlers do Next (App Router) exportam `GET(req: Request, ctx: { params: Promise<{...}> })` e retornam `NextResponse`. Dá para chamá-los direto num teste: `await GET(new Request('http://x'), { params: Promise.resolve({ title: 'Alpha' }) })`.
- As raízes vêm do env, lido no import (M2-01): defina `process.env.MANGA_ROOT` e `MANGA_XL_ROOT` **antes** do `await import(...)` da rota, num `beforeAll`.
- Biblioteca sintética: `makeLibrary(DEFAULT_SPEC)` de `apps/server/test/fixtures/makeLibrary.ts`.
- `services/metadata.ts` usa `cache()` do React. Se isso falhar fora do runtime do Next, mockar `react` com `vi.mock('react', async (orig) => ({ ...(await orig()), cache: (fn) => fn }))`.

## Início
- M2-02 commitado; `pnpm --filter @manga/server test` passa.

## Meio
1. Criar `apps/server/test/routes/read.test.ts` cobrindo, com **snapshots** (`toMatchSnapshot`) do JSON e asserções explícitas nos pontos críticos:
   - `/api/list`: inclui `Alpha` e `Beta` e não inclui `.hidden`;
   - `/api/read/[title]` (`Alpha`): a lista de capítulos tem um único representante do 566, que é `0566`, ignora `extras`, e `modified` tem uma chave por capítulo;
   - `/api/read/[title]/[chapter]` (`Alpha`, `1`): 3 imagens na ordem `1.jpg, 2.jpg, 10.jpg`, com caminhos `/api/read/Alpha/1/0..2`, ignorando `notes.txt`;
   - `/api/read/[title]/[chapter]` (`Alpha`, `566`): 4 imagens (venceu `0566`);
   - `/api/read/[title]/[chapter]/[index]`: `content-type` image/* e corpo idêntico ao arquivo em disco;
   - `/api/read/[title]/[chapter]/thumb` (`Beta`): retorna o `.thumb/Beta.jpg`; (`Alpha`) retorna o fallback (registrar no snapshot o status e o content-type, não o corpo);
   - `/api/metadata/[title]` (`Beta`): `categories` (como estão hoje, sem normalizar), `author`, `description` igual a `Texto`, e `thumbSource` igual a `curated`; (`Alpha`) metadados vazios e `thumbSource` igual a `crop`;
   - `/api/categories` e `/api/categories/[categoryId]`: snapshot.
   - Capítulo inexistente: status 404.
2. Criar `apps/server/test/routes/bind.test.ts`: `POST /api/bind` cria um arquivo em `<root>/.binds/<CODE>.json`; `GET /api/bind/[code]` lê esse arquivo; `POST /api/bind/[code]` faz o merge (snapshot); código inexistente no GET retorna 404.
3. Se algum comportamento parecer bug (por exemplo, o fallback de thumb), **não corrigir**: registrar no snapshot e anotar num comentário `// characterization: current behavior` no teste.

## Fim
- `pnpm --filter @manga/server test` passa, com os snapshots gerados e commitados em `__snapshots__/`.
- Rodar duas vezes seguidas dá o mesmo resultado, ou seja, não há dependência de horário. Se algum campo depender de mtime ou de `Date.now()`, normalizar no teste antes do snapshot.

## Arquivos
- Criar: `apps/server/test/routes/read.test.ts`, `apps/server/test/routes/bind.test.ts`, `apps/server/test/routes/__snapshots__/*`

## Fora do escopo
Alterar código de produção.

## Commit
`Add characterization tests for read, metadata, category and bind routes`
