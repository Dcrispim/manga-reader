# M1-03 — Mover o servidor para `apps/server`

**Marco:** 1.1.0 · **Depende de:** M1-02

## Objetivo
Colocar todo o código do Next.js em `apps/server/` preservando o histórico do git, ainda com npm, e com o build funcionando a partir de lá.

## Contexto mínimo
- Hoje tudo está na raiz de `<repo>`.
- **Ficam na raiz:** `.git`, `.gitignore`, `.dockerignore`, `Dockerfile` (será reescrito em M1-05), `docker-compose.yml` (**não alterar**), `README.md`, `scripts/release.sh`, `scripts/release.fish`, `docs/`, `.env` (ignorado, contém `UPSCALE_WORKER_TOKEN` usado pelo compose), `.code_rag/`.
- **Vão para `apps/server/`:** `src/`, `public/`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `package.json`, `package-lock.json`, `yarn.lock`.
- `scripts/upscale-worker.mjs` roda **no host** (não no container). Vai para `apps/server/scripts/upscale-worker.mjs`.

## Início
- Branch `milestone/1.1.0`, árvore limpa, M1-02 commitado.

## Meio
1. `mkdir -p apps/server/scripts`
2. `git mv` de cada item da lista "vão para" (inclusive `scripts/upscale-worker.mjs` → `apps/server/scripts/`).
3. Apagar `node_modules/`, `dist/` e `tsconfig.tsbuildinfo` da raiz (são artefatos, não versionados).
4. Grep por caminhos relativos que quebram: `grep -rn "upscale-worker" --exclude-dir=node_modules .` e ajustar referências em comentários/docs para o novo caminho. Atenção ao comentário em `docker-compose.yml`: **não** alterá-lo (restrição dura); anotar em `docs/baseline/notes.md` que o comentário referencia o caminho antigo.
5. Ajustar o `.gitignore` raiz: padrões ancorados como `/node_modules`, `/dist/`, `/.next/` passam a precisar valer em subpastas → trocar por `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo`, `next-env.d.ts`.
6. `cd apps/server && npm ci && npm run build`.

## Fim
- `git log --follow --oneline apps/server/src/utils/bind.ts | wc -l` > 1 (o histórico foi preservado).
- `cd apps/server && npm run build` termina com código 0.
- `git status --porcelain` limpo após o commit (sem `node_modules` nem `dist` rastreados).
- Na raiz restam apenas: `.gitignore .dockerignore Dockerfile docker-compose.yml README.md scripts/ docs/ apps/` (mais os itens ignorados).

## Arquivos
- Mover: lista acima
- Modificar: `.gitignore`
- Criar: `docs/baseline/notes.md`

## Fora do escopo
pnpm (M1-04), Dockerfile (M1-05).

## Commit
`Move the Next.js server into apps/server`
