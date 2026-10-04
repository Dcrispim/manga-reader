# Plano de execução — manga-reader monorepo + app Android

## Como um agente executa uma etapa

1. Leia `00-contexto.md` (restrições duras, layout, decisões) e **apenas** o arquivo da etapa.
2. Confira as condições em **Início**. Se alguma falhar, **pare e reporte** em vez de improvisar.
3. Execute o **Meio**. Mexa só nos arquivos listados em **Arquivos**. Se precisar tocar em outro, justifique no relatório.
4. Rode todas as verificações de **Fim** e cole a saída no relatório.
5. Faça um commit com a mensagem indicada (sem push).
6. Relatório final: o que foi feito, a saída das verificações, desvios do plano e pendências para o usuário.

Se a etapa disser "exige ação do usuário", pare nesse ponto e peça a ação explicitamente.

## Etapas

### Marco 1.1.0 — monorepo, sem mudança funcional (branch `milestone/1.1.0`)
| Etapa | Objetivo | Depende de |
|---|---|---|
| [M1-01](m1-01-baseline.md) | Branch do marco e baseline (build e erros de tsc) | — |
| [M1-02](m1-02-remover-electron.md) | Remover o Electron | M1-01 |
| [M1-03](m1-03-mover-para-apps-server.md) | Mover o Next para `apps/server` (com histórico) | M1-02 |
| [M1-04](m1-04-pnpm-workspace.md) | npm → workspace pnpm com as mesmas versões | M1-03 |
| [M1-05](m1-05-dockerfile-monorepo.md) | Dockerfile do monorepo **na raiz** | M1-04 |
| [M1-06](m1-06-smoke-docker.md) | `scripts/smoke.sh` e a imagem nova idêntica à estável | M1-05 |
| [M1-07](m1-07-ci.md) | CI no GitHub Actions | M1-04 |
| [M1-08](m1-08-docs-adr.md) | README, ADRs e cópia deste plano para o repo | M1-01…07 |

### Marco 1.2.0 — extração do `@manga/core` (branch `milestone/1.2.0`)
| Etapa | Objetivo | Depende de |
|---|---|---|
| [M2-01](m2-01-raizes-configuraveis.md) | `MANGA_ROOT`/`MANGA_XL_ROOT` via env | 1.1.0 |
| [M2-02](m2-02-vitest-e-fixtures.md) | Vitest no servidor e a biblioteca sintética | M2-01 |
| [M2-03](m2-03-caracterizacao-rotas.md) | Testes de caracterização das rotas | M2-02 |
| [M2-04](m2-04-caracterizacao-bind-history.md) | Testes de bind/history (com propriedades) | M2-02 |
| [M2-05](m2-05-packages-core-esqueleto.md) | Esqueleto do `packages/core` com lint anti-I/O | M2-02 |
| [M2-06](m2-06-core-bind-history.md) | bind/history → core | M2-03, 04, 05 |
| [M2-07](m2-07-core-formato-biblioteca.md) | Regras do formato da biblioteca → core | M2-03, 05 |
| [M2-08](m2-08-core-scanner.md) | `FsAdapter` e o scanner incremental | M2-07 |
| [M2-09](m2-09-zerar-tsc.md) | Zerar os erros de tsc e torná-lo obrigatório na CI | M2-02 |

### Marco 1.3.0 — APIs novas (branch `milestone/1.3.0`)
| Etapa | Objetivo | Depende de |
|---|---|---|
| [M3-01](m3-01-api-contract.md) | `@manga/api-contract` (zod) | 1.2.0 |
| [M3-02](m3-02-api-health.md) | `GET /api/health` com `serverId` | M3-01 |
| [M3-03](m3-03-api-catalog.md) | `GET /api/catalog?since=` e o teste de desempenho | M3-01, 02 |
| [M3-04](m3-04-smoke-docker-1.3.md) | Smoke do Docker com os endpoints novos | M3-03 |

### App mobile v1 (branch `milestone/mobile-v1`)
| Etapa | Objetivo | Depende de |
|---|---|---|
| [M4-01](m4-01-toolchain-android.md) | JDK, Android SDK, emuladores e Maestro (**usuário**) | — |
| [M4-02](m4-02-scaffold-expo.md) | Scaffold do Expo (development build) no monorepo | M4-01, 1.3.0 |
| [M4-03](m4-03-sqlite-drizzle.md) | Schema SQLite completo e migrações | M4-02 |
| [M4-04](m4-04-http-client.md) | Cliente HTTP que nunca lança e o `diag_log` | M4-03 |
| [M4-05](m4-05-status-servidor-e-config.md) | Status do servidor, Configurações e primeira execução | M4-04 |
| [M4-06](m4-06-sync-catalogo.md) | Sync engine do catálogo e o `FileStore` | M4-05 |
| [M4-07](m4-07-core-politica-espaco.md) | Política de espaço no core | 1.2.0 |
| [M4-08](m4-08-armazenamento-downloads.md) | Downloads atômicos, evicção e reconciliação | M4-06, 07 |
| [M4-09](m4-09-cache-transitorio-resolver.md) | Cache transitório e resolvedor de páginas | M4-08 |
| [M4-10](m4-10-fila-downloads.md) | Fila persistente ("baixar quando disponível") | M4-09 |
| [M4-11](m4-11-upgrade-high-res.md) | Jobs de upgrade para high-res | M4-10 |
| [M4-12](m4-12-historico-bind.md) | Histórico local e sync do bind | M4-05 |
| [M4-13](m4-13-orquestrador-background.md) | Ciclo de sync em primeiro e segundo plano | M4-06, 10, 11, 12 |
| [M4-14](m4-14-ui-catalogo.md) | UI: Início, categorias, título e busca | M4-13 |
| [M4-15](m4-15-leitor.md) | Leitor | M4-14 |
| [M4-16](m4-16-spike-saf.md) | Spike de desempenho do SAF (critério de 60 s) | M4-02, M2-08 |
| [M4-17](m4-17-fontes-locais.md) | Fontes locais via SAF | M4-16, 09, 14 |
| [M4-18](m4-18-telas-armazenamento-config.md) | Telas de armazenamento, fila, bind e diagnóstico | M4-14 |
| [M4-19](m4-19-maestro-definicao-de-pronto.md) | Fluxo Maestro = definição de pronto | M4-15, 18 |
| [M4-20](m4-20-build-release-apk.md) | APK de release com keystore e backup (**usuário**) | M4-19 |

## O que pode rodar em paralelo

> Análise completa (recursos compartilhados, mecânica de worktrees, linhas do tempo estrita e acelerada): [execucao-paralela.md](execucao-paralela.md).

- M1-07 junto com M1-05 e M1-06.
- M2-04, M2-05 e M2-09 depois de M2-02.
- M4-01 a qualquer momento (é só o ambiente).
- M4-07 assim que existir o 1.2.0.
- M4-12 junto com M4-06 a M4-11.
- M4-16 (spike) logo depois de M4-02: ele **reduz o risco cedo** e pode gerar uma etapa M4-16b (módulo Kotlin).
- M4-18 junto com M4-15.

## Etapa condicional
- **M4-16b — módulo Kotlin de listagem SAF:** só existe se o spike M4-16 falhar no critério. Deve ser escrita com base nos números do `docs/mobile/spike-saf.md`.
