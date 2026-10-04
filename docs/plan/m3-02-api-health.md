# M3-02 — `GET /api/health` com `serverId` persistente

**Marco:** 1.3.0 · **Depende de:** M3-01

## Objetivo
Criar o endpoint que permite ao app saber, com uma requisição barata, se o servidor está acessível, qual servidor é (identidade estável) e quais recursos ele oferece.

## Contexto mínimo
- Schema `Health` em `@manga/api-contract`: `{ serverId?: string, version: string, features: string[] }`.
- O `serverId` é um UUID gerado uma única vez e gravado em `SERVER_ID_PATH`, cujo padrão é `<MANGA_ROOT>/.server-id`. `MANGA_ROOT` vem de `apps/server/src/utils/paths.server.ts`.
- No container de teste, a biblioteca está montada com `:ro`, então `SERVER_ID_PATH` aponta para um tmpfs. **Se a escrita falhar, o endpoint responde sem `serverId`, nunca com erro.**
- `version` = campo `version` do `apps/server/package.json`. Esta etapa altera esse campo para `1.3.0`.
- `features`: nesta etapa, `[]`. A M3-03 acrescenta `"catalog"`.

## Início
- M3-01 commitado.

## Meio
1. `apps/server/src/utils/paths.server.ts`: acrescentar `SERVER_ID_PATH = process.env.SERVER_ID_PATH || path.join(MANGA_ROOT, '.server-id')`.
2. `apps/server/src/services/serverId.server.ts`: `getServerId(): Promise<string | undefined>`. Lê o arquivo; se não existir, gera `crypto.randomUUID()` e grava com `flag: 'wx'` (se outra requisição concorrente vencer a corrida, relê). Qualquer erro de I/O devolve `undefined`. Guarda o resultado em memória depois do primeiro sucesso.
3. `apps/server/src/services/features.server.ts`: `export const FEATURES: string[] = []`, com um comentário dizendo que o app usa isso para decidir o modo degradado.
4. `apps/server/src/app/api/health/route.ts`: `GET` devolve `{ serverId, version, features: FEATURES }`, com `export const dynamic = 'force-dynamic'` e header `Cache-Control: no-store`.
5. `apps/server/package.json`: `"version": "1.3.0"`.
6. Testes (`apps/server/test/routes/health.test.ts`):
   - diretório gravável: duas chamadas devolvem o mesmo `serverId` e o arquivo existe;
   - arquivo pré-existente: devolve o conteúdo dele;
   - diretório somente leitura (`chmod 0o555` num diretório temporário): devolve status 200 sem `serverId`;
   - a resposta valida com o schema `Health` do `@manga/api-contract`.

## Fim
- `pnpm --filter @manga/server test` passa.
- Manual: `MANGA_ROOT=<biblioteca sintética> pnpm --filter @manga/server exec next start -p 3994` e depois `curl -s localhost:3994/api/health` mostra `serverId`, `version` igual a `"1.3.0"` e `features` igual a `[]`.

## Arquivos
- Criar: `apps/server/src/services/serverId.server.ts`, `apps/server/src/services/features.server.ts`, `apps/server/src/app/api/health/route.ts`, `apps/server/test/routes/health.test.ts`
- Modificar: `apps/server/src/utils/paths.server.ts`, `apps/server/package.json`

## Fora do escopo
`/api/catalog`.

## Commit
`Add /api/health with a persistent server id`
