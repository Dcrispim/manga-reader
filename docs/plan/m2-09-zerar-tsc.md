# M2-09 — Zerar os erros de tipo e tornar o typecheck obrigatório

**Marco:** 1.2.0 (fecha o marco) · **Depende de:** M2-02

## Objetivo
`pnpm typecheck` passar em todo o workspace e virar etapa obrigatória na CI.

## Contexto mínimo
Erros conhecidos em `apps/server` (lista de `docs/baseline/tsc-1.0.8.txt`; os do `parserPSRT.test.ts` já somem com os globals do Vitest):
- `dist/types/...` (tipos gerados pelo build antigo, com `PageProps`): excluir `dist` do `tsconfig.json`;
- `src/components/ImagePsrt/index.tsx`: falta `@types/lodash`; `RefObject<HTMLImageElement | null>` incompatível com `RefObject<HTMLImageElement>`;
- `src/lib/prisma.ts`: `@prisma/client` não instalado. Verificar se alguém importa `@/lib/prisma`; se não, apagar o arquivo;
- `src/services/i18n/index.ts`: namespace `JSX` (usar `React.JSX`);
- `src/utils/style.ts`: `react-color` não instalado. Verificar o uso; se for só tipo, trocar por um tipo local; se ninguém usar o arquivo, apagar.

## Início
- M2-02 commitado (Vitest com `globals`).

## Meio
1. `apps/server/tsconfig.json`: em `include`, remover `dist/types/**/*.ts`; adicionar `"types": ["vitest/globals"]` (ou criar um `src/vitest.d.ts` com `/// <reference types="vitest/globals" />`); garantir `exclude: ["node_modules", "dist"]`.
2. Script `"typecheck": "tsc --noEmit"` em `apps/server/package.json`.
3. Corrigir cada erro com a menor mudança possível, **sem** alterar comportamento em runtime. Para os refs, ajustar a assinatura do hook ou utilitário que recebe o ref para aceitar `RefObject<HTMLImageElement | null>`.
4. Na CI (`.github/workflows/ci.yml`), remover o `continue-on-error` do passo de typecheck.
5. Build e smoke (3994 contra 3993).

## Fim
- `pnpm typecheck` na raiz termina com código 0.
- `pnpm test` e `pnpm --filter @manga/server build` passam.
- O smoke sai com código 0.

## Arquivos
- Modificar: `apps/server/tsconfig.json`, `apps/server/package.json`, `apps/server/src/components/ImagePsrt/index.tsx` (e o hook que recebe o ref, se for o caso), `apps/server/src/services/i18n/index.ts`, `.github/workflows/ci.yml`
- Possivelmente remover: `apps/server/src/lib/prisma.ts`, `apps/server/src/utils/style.ts`

## Fora do escopo
Desligar o `ignoreBuildErrors` do `next.config.ts` (pode ficar para depois; mencionar no commit).

## Commit
`Fix server type errors and make typecheck a CI gate`

> Fim do marco 1.2.0.
