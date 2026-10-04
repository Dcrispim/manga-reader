# M4-05 — Status do servidor, tela de Configurações e primeira execução

**Marco:** mobile v1 · **Depende de:** M4-04

## Objetivo
O app sabe a todo momento se o servidor está `unconfigured`, `online`, `offline` ou `mismatch`, e o usuário configura host e porta numa tela com "Testar conexão". Na primeira execução, o app abre direto nessa tela.

## Contexto mínimo
- `GET /api/health` → `{ serverId?, version, features[] }` (schema `Health` em `@manga/api-contract`). Timeout curto: **3 s**. Não confiar em "tem Wi-Fi", só numa requisição real.
- Settings (tabela `settings`): `server.host`, `server.port` (padrão 3993), `server.id` (o `serverId` visto pela última vez), `server.features` (JSON) e `server.version`.
- `mismatch`: o `/health` responde com um `serverId` diferente do salvo. O app **avisa e não apaga nada**: mostra um banner "Este endereço aponta para outro servidor", com as opções "Usar este servidor" (atualiza `server.id`) ou "Manter" (permanece em `mismatch`, e as sync engines não rodam).
- `health` sem `serverId` (o servidor não conseguiu gravar o id): é `online`, e não se salva o id.
- Cliente HTTP: `createClient` (M4-04).

## Início
- M4-04 commitado.

## Meio
1. `apps/mobile/src/server/status.ts`: `checkServer(client, db): Promise<ServerStatus>`, que atualiza `server.features` e `server.version` quando `online`, e um store reativo mínimo (zustand, ou um `useSyncExternalStore` próprio) com `status`, `lastCheckedAt` e `features`. Exporta `hasFeature(name)`.
2. `apps/mobile/src/server/useServerStatus.ts`: o hook que lê o store, revalida ao focar o app (`AppState` `active`) e a cada 30 s com o app em primeiro plano.
3. `apps/mobile/app/settings/index.tsx` (pt-BR):
   - campos Host e Porta (numérico, padrão 3993); validação simples (host não vazio; porta de 1 a 65535);
   - botão **Testar conexão**: chama `/api/health` no endereço digitado (ainda não salvo) e mostra "Conectado — versão X, N ms" ou "Não foi possível conectar" (texto neutro, sem detalhes técnicos);
   - **Salvar**: se o teste não passou, pede uma confirmação "Salvar mesmo assim?";
   - mostra o status atual e o `serverId` resumido (8 caracteres).
4. Primeira execução: em `app/_layout.tsx` (ou `app/index.tsx`), se `server.host` não existir, redirecionar para `/settings`.
5. Indicador global discreto: um componente `ServerStatusPill` (verde, cinza ou amarelo) para o header.
6. Testes: `checkServer` com um cliente falso para online, offline (timeout), mismatch, sem `serverId` e não configurado; os settings são atualizados corretamente; nada lança.

## Fim
- Testes passando.
- No emulador: apagar os dados do app, abrir, cair em Configurações, digitar `10.0.2.2` e `3993`, testar, ver a versão do servidor estável e salvar. Em seguida, digitar a porta `3999`, testar e ver "Não foi possível conectar", **sem** tela de erro.

## Arquivos
- Criar: `apps/mobile/src/server/{status.ts,useServerStatus.ts}`, `apps/mobile/app/settings/index.tsx`, `apps/mobile/src/ui/ServerStatusPill.tsx`, `apps/mobile/src/server/__tests__/status.test.ts`
- Modificar: `apps/mobile/app/_layout.tsx`

## Fora do escopo
Configurações de espaço e de bind (M4-18).

## Commit
`Add server status tracking and the connection settings screen`
