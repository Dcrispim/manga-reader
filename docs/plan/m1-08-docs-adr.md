# M1-08 — README do monorepo, ADRs e cópia do plano

**Marco:** 1.1.0 (fecha o marco) · **Depende de:** M1-01 a M1-07

## Objetivo
Documentar o novo layout e registrar as decisões de arquitetura como ADRs, para que qualquer pessoa (ou agente) entenda o porquê sem ler a conversa original.

## Contexto mínimo
- O `README.md` da raiz ainda é o padrão do `create-next-app`.
- O plano completo está em `~/projs/manga-reader-app/docs/plan/` (fora do repo). O resumo das decisões está em `00-contexto.md`, seção "Decisões de produto".

## Início
- M1-01 a M1-07 commitados.

## Meio
1. Copiar `~/projs/manga-reader-app/docs/plan/` para `<repo>/docs/plan/`.
2. Reescrever o `README.md` da raiz (pt-BR):
   - o que é o projeto e o layout do monorepo (a árvore do contexto);
   - pré-requisitos (Node 22+, corepack/pnpm 10, Docker);
   - comandos: `pnpm install`, `pnpm --filter @manga/server dev`, `pnpm test`, `pnpm typecheck`;
   - deploy: o compose builda a `stable/*` com o `Dockerfile` da raiz; o `scripts/release.sh` corta releases (uso exclusivo do mantenedor);
   - `scripts/smoke.sh`: o que faz e um exemplo;
   - o `upscale-worker` roda no host, em `apps/server/scripts/upscale-worker.mjs`.
3. Criar `docs/adr/` com um arquivo por decisão, no formato curto (Contexto / Decisão / Consequências):
   - `0001-app-android-nativo.md`: por que nativo em vez de HTTPS no PWA (Android descarta a aba e, sem *secure context*, não há service worker).
   - `0002-monorepo-pnpm.md`: pnpm sem Nx; Dockerfile na raiz para não mudar compose/release.
   - `0003-sqlite-fonte-de-verdade.md`: a UI só lê SQLite; sync engines; o cliente HTTP nunca lança.
   - `0004-gestao-de-espaco.md`: números e regras de evicção, cache transitório.
   - `0005-catalogo-incremental.md`: `/api/catalog?since=`, `/api/health`, `serverId`.
   - `0006-fontes-locais-saf.md`: SAF por causa da Play Store; spike de 60 s.
   - `0007-bind-reutilizado.md`: contrato inalterado; posição de página adiada.
4. Remover `docs/baseline/notes.md` se o conteúdo dele já estiver coberto no README; senão, manter.

## Fim
- `ls docs/adr | wc -l` = 7.
- O README não contém mais "create-next-app" nem "Vercel".
- Os comandos citados no README funcionam (rodar `pnpm install` e `pnpm test`).

## Arquivos
- Modificar: `README.md`
- Criar: `docs/adr/0001…0007-*.md`, `docs/plan/*`

## Fora do escopo
Documentar o app mobile (ainda não existe).

## Commit
`Document the monorepo layout and record architecture decisions`

> Fim do marco 1.1.0: o usuário revisa, faz o merge em `main` e decide quando cortar a release (fora do escopo dos agentes).
