# 0002 — Monorepo pnpm (sem Nx)

**Data:** 2026-10-04 · **Status:** Aceito

## Contexto

Construímos múltiplos pacotes: servidor (Next.js), app mobile (Expo), bibliotecas compartilhadas (core, api-contract).

## Decisão

Usar **pnpm workspace** sem Nx. Dockerfile fica na **raiz do repo** (não em `apps/server/`).

## Consequências

- **Simplicidade**: pnpm nativo, sem overhead de orquestração (Nx).
- **Estrutura clara**: `apps/server`, `apps/mobile`, `packages/core`, `packages/api-contract`.
- **Docker estável**: `docker-compose.yml` e `scripts/release.sh` não mudam, pois context é a raiz e o Dockerfile constrói `@manga/server` sem movê-lo.
- **Consumo de código-fonte**: pacotes internos exportam TS direto (`"exports": { ".": "./src/index.ts" }`); Next.js consome via `transpilePackages`, Metro e Vitest direto.
