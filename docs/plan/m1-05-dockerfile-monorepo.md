# M1-05 — Dockerfile do monorepo (na raiz)

**Marco:** 1.1.0 · **Depende de:** M1-04

## Objetivo
Reescrever o `Dockerfile` da raiz para buildar `apps/server` a partir do workspace pnpm, gerando uma imagem equivalente à atual, **sem alterar `docker-compose.yml`**.

## Contexto mínimo
- Produção: o `docker-compose.yml` builda com `context: https://github.com/Dcrispim/manga-reader.git#stable/X.Y.Z` usando o `Dockerfile` **padrão da raiz**. O `scripts/release.sh` só reescreve a linha `context:`. Por isso o Dockerfile fica na raiz: compose e release continuam funcionando sem mudança.
- Dockerfile atual (para referência de comportamento): base `node:22-alpine`; etapa de deps com `apk add python3 make g++` e `npm ci`; `ARG/ENV NEXT_PUBLIC_API_URL`; `npm run build`; o runner copia `dist`, `public`, `node_modules`, `package.json` e `next.config.ts`; `EXPOSE 3993`; `CMD npm run start -- -p 3993 -H 0.0.0.0`.
- `next.config.ts` usa `distDir: "dist"`.
- O pnpm 10 `deploy` exige `--legacy` ou `inject-workspace-packages=true`.

## Início
- M1-04 commitado; `pnpm --filter @manga/server build` passa no host.

## Meio
1. Reescrever o `Dockerfile` (esqueleto — ajustar o que for necessário para funcionar):
   ```dockerfile
   # syntax=docker/dockerfile:1
   FROM node:22-alpine AS base
   RUN corepack enable
   WORKDIR /repo

   FROM base AS build
   RUN apk add --no-cache python3 make g++
   COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
   RUN pnpm fetch
   COPY . .
   ARG NEXT_PUBLIC_API_URL
   ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
   RUN pnpm install --offline --frozen-lockfile --filter @manga/server...
   RUN pnpm --filter @manga/server build
   RUN pnpm --filter @manga/server deploy --prod --legacy /out \
    && cp -r apps/server/dist apps/server/public apps/server/next.config.ts /out/

   FROM node:22-alpine AS runner
   ARG NEXT_PUBLIC_API_URL
   ENV NODE_ENV=production
   ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
   WORKDIR /app
   COPY --from=build /out ./
   EXPOSE 3993
   CMD ["node_modules/.bin/next", "start", "-p", "3993", "-H", "0.0.0.0"]
   ```
2. `.dockerignore` da raiz: `**/node_modules`, `**/dist`, `**/.next`, `.git`, `.env*`, `.code_rag`, `apps/mobile`, `docs`, logs.
3. `docker build -t manga-reader:monorepo-test --build-arg NEXT_PUBLIC_API_URL=http://localhost:3993 .`
4. Verificar que os módulos nativos carregam na imagem: `docker run --rm manga-reader:monorepo-test node -e "require('better-sqlite3'); require('sharp'); console.log('ok')"`.

## Fim
- O build da imagem termina com código 0.
- O comando do passo 4 imprime `ok`.
- `git diff main -- docker-compose.yml scripts/release.sh` está vazio.
- `docker images manga-reader:latest` mostra o **mesmo IMAGE ID** de antes da etapa (anotar antes de começar).

## Arquivos
- Modificar: `Dockerfile`, `.dockerignore`

## Fora do escopo
Rodar a imagem servindo tráfego (M1-06). Qualquer `docker compose`.

## Commit
`Build the server image from the pnpm workspace`
