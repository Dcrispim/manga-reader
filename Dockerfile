# syntax=docker/dockerfile:1

# The Dockerfile stays at the repo root so docker-compose.yml (which builds from
# a git context) and scripts/release.sh keep working unchanged.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Toolchain for native modules (better-sqlite3, sharp) when no prebuilt binary fits
RUN apk add --no-cache python3 make g++
# Manifests first so `pnpm fetch` is cached until the lockfile changes
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm install --offline --frozen-lockfile --filter @manga/server...
RUN pnpm --filter @manga/server build
# --legacy: pnpm 10 deploy otherwise requires inject-workspace-packages=true
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
