# Manga Reader

Um leitor de mangá para Android com suporte a offline-first, sincronização de progresso e bibliotecas locais via Storage Access Framework.

## Arquitetura

Este é um **monorepo pnpm** com layout:

```
<repo>/
  Dockerfile               ← builda apps/server (contexto = raiz)
  docker-compose.yml       ← composição de produção (stable/*)
  pnpm-workspace.yaml      ← configuração do monorepo
  package.json             ← raiz, private, scripts agregados
  scripts/                 ← release.sh, smoke.sh
  docs/
    adr/                   ← Architecture Decision Records
    plan/                  ← etapas de implementação (histórico)
  apps/server/             ← Next.js 15 (API + web UI)          — pacote @manga/server
  apps/mobile/             ← app Expo / React Native (Android)   — pacote @manga/mobile
  packages/core/           ← TypeScript puro compartilhado       — pacote @manga/core
  packages/api-contract/   ← schemas Zod da API REST            — pacote @manga/api-contract
```

**Pacotes internos** exportam código-fonte TypeScript direto (`"exports": { ".": "./src/index.ts" }`), sem etapa de build. O Next.js consome via `transpilePackages`; o Metro e o Vitest consomem direto.

## Pré-requisitos

- **Node 22+** (use `nvm` ou similar)
- **pnpm 10+** via `corepack enable` (incluído no Node)
- **Docker** (para validação da imagem, testes de integração)

## Desenvolvimento

### Instalar dependências

```bash
pnpm install
```

### Rodar o servidor (Next.js)

```bash
pnpm --filter @manga/server dev
```

Acessa [http://localhost:3000](http://localhost:3000).

### Rodar testes

```bash
pnpm test
```

Executa Vitest em `packages/*` e `apps/server`; jest-expo em `apps/mobile`.

### Verificação de tipos

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

## Build e Deploy

### Docker (local)

O `Dockerfile` fica na raiz (propositalmente) para que `docker-compose.yml` e `scripts/release.sh` não precisem mudar. Ele builda e roda apenas `apps/server`.

Para validar a imagem (cria container efêmero em `:3994`):

```bash
docker build -t manga-reader:monorepo-test \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3993 .
docker run --rm -d --name manga-reader-monorepo-test -p 3994:3993 \
  -v /mnt/d/manga:/mnt/d/manga:ro \
  -v /mnt/d/manga-xl:/mnt/d/manga-xl:ro \
  --tmpfs /var/lib/manga-test \
  -e SERVER_ID_PATH=/var/lib/manga-test/.server-id \
  manga-reader:monorepo-test
# Rodar testes...
docker stop manga-reader-monorepo-test
```

### Release (produção)

O script `scripts/release.sh` é **uso exclusivo do mantenedor** e cria/pusha branches `stable/*`.

**Nunca** altere ou execute `scripts/release.sh` ou `scripts/release.fish`.

## smoke.sh — Testes de regressão

Compara respostas GET de duas instâncias (ex.: stable em `:3993` vs monorepo-test em `:3994`).

Exemplo:

```bash
scripts/smoke.sh http://localhost:3993 http://localhost:3994
```

Retorna `OK` ou `DIFF` para cada rota, comparando:
- JSON normalizado (chaves ordenadas) + status HTTP
- Imagens: status, content-type, SHA256

Nunca chama rotas mutantes (`/bind`, `/upscale`, `/search/rebuild`).

## upscale-worker

O worker de upscale roda no host em `apps/server/scripts/upscale-worker.mjs`. Processa imagens de alta resolução em background (fora da request do Next.js).

## Documentação

- **ADRs** (`docs/adr/`): decisões de arquitetura (sqlite offline-first, monorepo, sync engines, etc.)
- **Plano** (`docs/plan/`): histórico de etapas e marcos de implementação (M1–M4, com ~80 etapas)

## Restrições (hard constraints)

1. Não mexer no container estável em `:3993` (porta, rede, volumes).
2. Não criar/alterar/apagar branches `stable/*`.
3. Não executar `scripts/release.sh` nem `scripts/release.fish`.
4. Não fazer `git push` (commits locais apenas; o mantenedor revisa e publica).
5. GET only contra `:3993` (sem `POST /api/bind`, `/upscale`, etc.).
6. Nunca usar `pkill`, `killall` ou `kill` por padrão (riscos de matar o container estável).
7. Dados em `/mnt/d/manga*` são **somente leitura** para testes.

## Tecnologias

- **Servidor**: Next.js 15, Node.js 22, TypeScript
- **API**: REST com schemas Zod
- **Mobile**: Expo, React Native, SQLite (DrizzleORM)
- **Testes**: Vitest, jest-expo, Maestro (E2E Android)
- **Containerização**: Docker, Alpine Linux

## Licença

Todos os direitos reservados.
