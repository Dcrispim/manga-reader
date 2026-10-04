# M1-04 — Trocar npm por um workspace pnpm

**Marco:** 1.1.0 · **Depende de:** M1-03

## Objetivo
Transformar o repositório num workspace pnpm com `apps/*` e `packages/*`, mantendo **as mesmas versões resolvidas** das dependências do servidor.

## Contexto mínimo
- O servidor está em `apps/server` com `package-lock.json` (fonte de verdade das versões) e um `yarn.lock` legado.
- O pnpm 10 **bloqueia scripts de postinstall** por padrão. O servidor depende de módulos nativos (`better-sqlite3`, `sharp`) que precisam deles.
- O pnpm não está instalado no host; usar `corepack`.

## Início
- M1-03 commitado; `apps/server/package-lock.json` existe.

## Meio
1. `corepack enable && corepack prepare pnpm@10 --activate` (se o corepack pedir permissão de escrita no prefixo do nvm, usar `corepack enable --install-directory ~/.local/bin`). Conferir com `pnpm -v` (10.x).
2. `pnpm-workspace.yaml` na raiz:
   ```yaml
   packages:
     - apps/*
     - packages/*
   onlyBuiltDependencies:
     - better-sqlite3
     - sharp
   ```
   (Se o `pnpm install` avisar sobre outros pacotes com build scripts ignorados que sejam necessários em runtime, acrescentá-los aqui e registrar na mensagem de commit.)
3. `package.json` raiz:
   ```json
   {
     "name": "manga-reader-monorepo",
     "private": true,
     "packageManager": "pnpm@<versão exata do passo 1>",
     "scripts": {
       "build": "pnpm -r build",
       "test": "pnpm -r --if-present test",
       "typecheck": "pnpm -r --if-present typecheck",
       "lint": "pnpm -r --if-present lint"
     }
   }
   ```
4. Em `apps/server/package.json`: `"name": "@manga/server"`.
5. `cd apps/server && pnpm import` (gera um `pnpm-lock.yaml` a partir do `package-lock.json`). Mover o `pnpm-lock.yaml` gerado para a raiz se ele tiver sido criado em `apps/server`; senão, rodar `pnpm install` na raiz e conferir que as versões principais batem (passo 8).
6. `git rm apps/server/package-lock.json apps/server/yarn.lock`.
7. `pnpm install` na raiz.
8. Conferir as versões: `pnpm --filter @manga/server list next react react-dom better-sqlite3 sharp` precisa bater com as versões que estavam no `package-lock.json` removido (`git show HEAD:apps/server/package-lock.json | grep -A2 '"node_modules/next"'` etc.).
9. `pnpm --filter @manga/server build`.
10. Smoke local fora do Docker: `pnpm --filter @manga/server exec next start -p 3994 -H 127.0.0.1 &`, depois `curl -sf localhost:3994/api/list | head -c 200` e `curl -sf localhost:3994/api/categories | head -c 200`. Encerrar o processo.

## Fim
- `pnpm install --frozen-lockfile` na raiz termina com código 0.
- `pnpm --filter @manga/server build` termina com código 0.
- O smoke do passo 10 retorna JSON nas duas rotas.
- `git ls-files | grep -E "package-lock|yarn.lock"` não retorna nada.

## Arquivos
- Criar: `pnpm-workspace.yaml`, `package.json` (raiz), `pnpm-lock.yaml`
- Modificar: `apps/server/package.json`
- Remover: `apps/server/package-lock.json`, `apps/server/yarn.lock`

## Fora do escopo
Dockerfile (M1-05). Atualizar versões de dependências.

## Commit
`Switch to a pnpm workspace`
