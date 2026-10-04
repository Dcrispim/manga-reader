# Contexto comum (leia antes de qualquer etapa)

Este arquivo é o único contexto global necessário. Cada etapa (`mX-YY-*.md`) é autocontida: leia **este arquivo + a etapa** e nada mais do plano.

## O que está sendo construído

- Um **app Android** (Expo / React Native, celular + tablet) que consome a API do servidor **manga-reader** (Next.js 15, rodando num container Docker na rede local, porta 3993, HTTP, sem autenticação).
- O app é **offline-first**: a UI lê **somente** do SQLite local; "sync engines" são os únicos módulos que falam com a rede ou com o filesystem do aparelho. Nenhum erro pode aparecer para o usuário se a API cair ou imagens faltarem — sempre fallback limpo.
- O repositório do servidor vira um **monorepo pnpm** (sem Nx).

## Repositório

- Raiz do monorepo: `~/projs/manga-reader` (doravante `<repo>`). Remote: `git@github.com:Dcrispim/manga-reader.git`.
- Layout alvo:

```
<repo>/
  Dockerfile               ← builda apps/server (contexto = raiz). Fica NA RAIZ de propósito:
                             assim docker-compose.yml e scripts/release.sh não mudam.
  docker-compose.yml       ← NÃO alterar (aponta para a branch stable/* em produção)
  pnpm-workspace.yaml
  package.json             ← raiz, private, scripts agregados
  scripts/                 ← release.sh, release.fish (NÃO executar), smoke.sh
  docs/                    ← adr/, plan/
  apps/server/             ← o Next.js atual (UI web + API)  — pacote @manga/server
  apps/mobile/             ← app Expo                         — pacote @manga/mobile
  packages/core/           ← TS puro compartilhado            — pacote @manga/core
  packages/api-contract/   ← schemas zod da API               — pacote @manga/api-contract
```

- Pacotes internos exportam **código-fonte TS** (`"exports": { ".": "./src/index.ts" }`), sem etapa de build. O Next consome via `transpilePackages`; o Metro e o Vitest consomem direto.

## Restrições DURAS (valem para todas as etapas)

1. **Não tocar no container estável** que está rodando (porta 3993): não parar, não reiniciar, não `docker compose up/down/build`, não retaguear `manga-reader:latest`.
2. **Não criar, alterar, apagar nem fazer push de branches `stable/*`.**
3. **Não executar** `scripts/release.sh` nem `scripts/release.fish`.
4. **Não fazer `git push`.** Commits só locais; o usuário revisa e publica.
5. Contra o servidor estável em `http://localhost:3993` só são permitidas requisições **GET** (para comparação). Nunca POST (bind, upscale, rebuild).
6. Validação de imagem Docker: só a tag `manga-reader:monorepo-test`, rodando como container efêmero:

   ```bash
   docker run --rm -d --name manga-reader-monorepo-test -p 3994:3993 \
     -v /mnt/d/manga:/mnt/d/manga:ro -v /mnt/d/manga-xl:/mnt/d/manga-xl:ro \
     --tmpfs /var/lib/manga-test \
     -e SERVER_ID_PATH=/var/lib/manga-test/.server-id \
     manga-reader:monorepo-test
   # ... testes ...
   docker stop manga-reader-monorepo-test
   ```

   Com volumes `:ro`, `POST /api/bind` retorna 500 — **esperado**, não é regressão.
7. O shell do usuário é **fish**: para processos em background, use `bash -c 'cmd & echo $! > /tmp/claude-1000/<etapa>.pid'` e encerre lendo esse arquivo.
   **Nunca** usar `pkill`, `killall` ou `kill` por nome/padrão: processos do container estável aparecem na tabela de processos do host. Encerrar só o PID que a própria etapa iniciou (guarde `$!`).
8. Escrita em disco **só** dentro do repositório/worktree, de `/tmp/claude-1000/`, de `os.tmpdir()` (para fixtures pequenas) e de `~/.cache/`. Qualquer outro lugar (outros discos, `/mnt/*`): **pare e reporte**. Atenção: o btrfs de `/home` tem pouco espaço de metadados — não gere centenas de milhares de arquivos sem necessidade.
9. Os dados reais em `/mnt/d/manga` são **somente leitura** para qualquer teste. Testes usam bibliotecas sintéticas em diretórios temporários.

## Branches e commits

- Uma branch por marco, criada a partir de `main`: `milestone/1.1.0`, `milestone/1.2.0`, `milestone/1.3.0`, `milestone/mobile-v1`. Cada marco parte do anterior já mergeado em `main` pelo usuário (se não estiver, partir da branch do marco anterior).
- Um commit por etapa, mensagem em inglês no imperativo (padrão do histórico, ex.: `Add offline-first reading: ...`), terminando com:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Comentários de código em inglês, explicando o *porquê* (estilo do código existente). Textos de UI em pt-BR.

## Formato da biblioteca (servidor e fontes locais do app)

```
<raiz>/
  <título>/<capítulo>/<imagens>    capítulo = nome numérico (parseFloat); "566" e "0566" são o MESMO
                                   capítulo → vence a pasta com mais arquivos. Pastas não numéricas são ignoradas.
                                   Imagens: arquivos cujo mime é image/*, ordenados: nomes puramente
                                   numéricos primeiro (por valor), depois localeCompare.
  .thumb/<título>.jpg              capa curada (opcional; senão, 1ª página do capítulo 01)
  .meta/<título>.metadata          linhas key=value (categories, author|authors, volumes, status, type,
                                   demographic, published, description|synopsis|sinopse); '#' = comentário
  .binds/<CODE>.json               progresso sincronizado (só no servidor)
```

## Números de referência (dimensionamento)

- Capacidade total do servidor: **200 títulos × 400 capítulos × 15 páginas** (80 mil capítulos, 1,2 mi páginas).
- Projeção "cega" de tamanho: **1 MB por página**; capítulo sem contagem conhecida = 15 páginas = 15 MB.
- Fontes locais no aparelho: até ~30 GB ≈ 2.000 capítulos.

## Decisões de produto (resumo — não reabrir)

- Catálogo completo sincronizado ativamente via `GET /api/catalog?since=` (incremental); fica **fora** do orçamento de espaço.
- `GET /api/health` → `{ serverId?, version, features: string[] }`; `serverId` em `SERVER_ID_PATH` (padrão `<MANGA_ROOT>/.server-id`).
- Espaço (downloads): 5 capítulos/título, 100 globais, teto 2 GB, piso de disco livre 1 GB; evicção: **lidos primeiro**, depois não lidos, cada grupo por `savedAt` mais antigo; nunca evicta o recém-salvo nem o aberto; evicção roda também offline.
- Cache transitório de leitura online: 300 MB, LRU, separado dos downloads; "baixar" um capítulo que está nele = mover.
- Fila de download persistente: (a) aguardar servidor, (c) upgrade para high-res sem teto de polling; retoma por página; 2 requisições de imagem simultâneas; background ~15 min só em Wi-Fi.
- Configuração: endereço único (host + porta, padrão 3993), "Testar conexão", cleartext HTTP habilitado, primeira execução abre Configurações.
- Progresso: reutiliza o `bind` (código de 6 chars) sem mudar o contrato; "lido" = presente no histórico mesclado.
- Fontes locais: SAF (Storage Access Framework), somente leitura, fora da gestão de espaço; título com mesmo nome em várias fontes = um título; prioridade de leitura: local > baixado > cache transitório > servidor.
- Fora da v1: deform, upscale manual, PSRT, páginas duplas, posição de página, assinatura de capítulos novos (v1.1).
- Distribuição: APK na v1, Play Store depois; build local; keystore com backup.

## Ferramentas

- Node 22+ (host tem v24 via nvm), pnpm 10 via `corepack`, Docker disponível.
- Testes: **Vitest** em `packages/*` e `apps/server`; **jest-expo** em `apps/mobile`; **Maestro** para E2E.
