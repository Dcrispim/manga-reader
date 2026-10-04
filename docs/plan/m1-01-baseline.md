# M1-01 — Branch do marco e baseline do servidor

**Marco:** 1.1.0 (monorepo, sem mudança funcional) · **Depende de:** nada

## Objetivo
Criar a branch `milestone/1.1.0` e registrar o estado atual do servidor (build e erros de tipo) para que as etapas seguintes provem que nada mudou.

## Contexto mínimo
- O servidor é Next.js 15 em `<repo>` (raiz), hoje com npm (`package-lock.json`) e também um `yarn.lock` sobrando.
- `next.config.ts` tem `typescript.ignoreBuildErrors: true`, então o build passa mesmo com erros de tipo. Hoje há ~44 erros de `tsc`, dos quais 35 vêm de `src/services/psrt/parserPSRT.test.ts` (sem test runner) e 9 de outros arquivos.

## Início (pré-condições verificáveis)
- `git -C <repo> status --porcelain` mostra no máximo `?? .code_rag/` e `?? scripts/release.fish` (não tocar neles).
- `git -C <repo> rev-parse --abbrev-ref HEAD` = `main`.

## Meio
1. `git -C <repo> checkout -b milestone/1.1.0`.
2. Adicionar `.code_rag/` ao `.gitignore` (é índice de busca local).
3. Commitar `scripts/release.fish` como está (está fora do controle de versão; é par do `release.sh`).
4. `cd <repo> && npm ci && npm run build` — deve passar.
5. Gerar `docs/baseline/tsc-1.0.8.txt` com `npx tsc --noEmit 2>&1 | grep "error TS" | sort` (o diretório `dist/types` gerado pelo build pode entrar na lista — tudo bem, é o retrato atual).
6. Gerar `docs/baseline/routes.txt` listando as rotas: `find src/app/api -name route.ts | sort`.

## Fim (verificação)
- `npm run build` termina com código 0.
- `docs/baseline/tsc-1.0.8.txt` e `docs/baseline/routes.txt` existem e não estão vazios.
- `git status --porcelain` limpo após o commit.

## Arquivos
- Modificar: `.gitignore`
- Criar: `docs/baseline/tsc-1.0.8.txt`, `docs/baseline/routes.txt`
- Adicionar ao git: `scripts/release.fish`

## Fora do escopo
Corrigir erros de tipo; mexer em dependências.

## Commit
`Record pre-monorepo baseline and track release.fish`
