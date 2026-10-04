# M2-05 — Esqueleto do `packages/core`

**Marco:** 1.2.0 · **Depende de:** M2-02

## Objetivo
Criar o pacote `@manga/core` (TypeScript puro, sem I/O), consumível pelo Next sem build e com uma regra de lint que **impede** imports de Node, React Native ou do DOM.

## Contexto mínimo
- O core vai rodar no servidor (Next/Node) e no app (Hermes/React Native). Por isso não pode importar `fs`, `path`, `node:*`, `react`, `react-native`, `expo*` nem usar APIs do DOM. Todo I/O entra por adapters (interfaces) definidos nele.
- Pacotes internos exportam o código-fonte TS: `"exports": { ".": "./src/index.ts" }`.
- O Next precisa de `transpilePackages: ['@manga/core']` para consumir TS de dentro do workspace.

## Início
- M2-02 commitado.

## Meio
1. `packages/core/package.json`:
   ```json
   {
     "name": "@manga/core",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts" },
     "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit", "lint": "eslint src" }
   }
   ```
   devDependencies: `typescript`, `vitest`, `eslint`, `typescript-eslint`.
2. `packages/core/tsconfig.json`: `strict`, `target`/`lib` ES2022 **sem** `dom`, `types: []`, `moduleResolution: bundler`, `noEmit`, `isolatedModules`.
3. `packages/core/eslint.config.mjs`: flat config com `typescript-eslint` e uma regra `no-restricted-imports` que proíbe `fs`, `fs/*`, `path`, `node:*`, `react`, `react-native`, `expo*` e `next*`, com a mensagem "core must stay I/O-free; inject an adapter".
4. `packages/core/src/index.ts` exportando `export const CORE_VERSION = 1`.
5. `packages/core/src/index.test.ts`, um teste trivial.
6. Adicionar `"@manga/core": "workspace:*"` às dependências de `apps/server` e `transpilePackages: ['@manga/core']` em `apps/server/next.config.ts`.
7. Provar o consumo: num arquivo do servidor qualquer **só de teste** (`apps/server/test/core-import.test.ts`), importar `CORE_VERSION` de `@manga/core` e conferir que vale 1.

## Fim
- `pnpm --filter @manga/core test`, `typecheck` e `lint` passam.
- Criar temporariamente `import fs from 'fs'` em `packages/core/src/index.ts`: o lint **falha**. Remover a linha depois.
- `pnpm --filter @manga/server test` e `build` passam.

## Arquivos
- Criar: `packages/core/{package.json,tsconfig.json,eslint.config.mjs,src/index.ts,src/index.test.ts}`, `apps/server/test/core-import.test.ts`
- Modificar: `apps/server/package.json`, `apps/server/next.config.ts`, `pnpm-lock.yaml`

## Fora do escopo
Mover lógica (M2-06 em diante).

## Commit
`Add @manga/core package skeleton`
