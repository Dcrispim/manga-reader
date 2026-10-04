# M4-04 — Cliente HTTP que nunca lança, e log de diagnóstico

**Marco:** mobile v1 · **Depende de:** M4-03

## Objetivo
Criar o **único** ponto do app que fala HTTP com o servidor. Ele aplica timeout e validação zod, e transforma qualquer falha num `Result` (nunca uma exceção), registrando a falha no `diag_log`.

## Contexto mínimo
- Requisito de produto: nenhum erro pode chegar à UI se a API quebrar. JSON inválido ou fora do schema conta como "indisponível".
- Schemas e construtores de caminho: `@manga/api-contract` (`schemas`, `paths`, `resolveUrl(base, relative)`). As rotas de capítulo devolvem caminhos **relativos** (`/api/read/...`), e o cliente prefixa `http://<host>:<port>`.
- Tabela `diag_log(at, level, scope, message)` (M4-03). O log tem teto: manter no máximo ~5.000 linhas (≈1 MB), apagando as mais antigas.
- O endereço vem de `settings` (`server.host`, `server.port`). Sem endereço configurado, o resultado é `unconfigured`.

## Início
- M4-03 commitado.

## Meio
1. `apps/mobile/src/lib/result.ts`: `type Result<T> = { ok: true; value: T } | { ok: false; reason: 'unconfigured' | 'unreachable' | 'timeout' | 'http' | 'invalid'; status?: number }`.
2. `apps/mobile/src/diag/log.ts`: `log(db, level, scope, message)` e `trimLog(db, max = 5000)`. Nunca lança (envolver em try/catch). Mensagens truncadas em 500 caracteres.
3. `apps/mobile/src/settings/repo.ts`: `getSetting`, `setSetting`, `getServerBase(db): string | null` (monta `http://host:port`) e os padrões de cada chave num objeto `DEFAULTS` (porta 3993).
4. `apps/mobile/src/net/client.ts`: `createClient({ db, fetchImpl = fetch, now = Date.now })` devolvendo:
   - `getJson<T>(path, schema, { timeoutMs = 8000 })`: `Result<T>`;
   - `postJson<T>(path, body, schema, opts)`: `Result<T>`;
   - `url(pathOrRelative)`: `string | null` (URL absoluta para imagens);
   - timeout via `AbortController`; status diferente de 2xx vira `http`; `JSON.parse` falhando vira `invalid`; `safeParse` falhando vira `invalid`; erro de rede vira `unreachable`. Cada falha gera uma linha `warn` no `diag_log` com `scope='net'`.
5. Testes `src/net/__tests__/client.test.ts`, com um `fetchImpl` falso e o `testDb`: sucesso; timeout; 500; corpo não-JSON; JSON fora do schema; `fetch` rejeitando (`TypeError`); servidor não configurado. **Nenhum** caso pode lançar, e todos os de falha geram uma linha no `diag_log`. Teste do teto do log.

## Fim
- `pnpm --filter @manga/mobile test` passa.
- `grep -rn "fetch(" apps/mobile/src --include=*.ts --include=*.tsx | grep -v "net/client.ts\|__tests__"` não encontra nada (regra: só o cliente usa `fetch`; downloads de arquivo usam o `expo-file-system` em M4-09).

## Arquivos
- Criar: `apps/mobile/src/lib/result.ts`, `apps/mobile/src/diag/log.ts`, `apps/mobile/src/settings/repo.ts`, `apps/mobile/src/net/client.ts`, `apps/mobile/src/net/__tests__/client.test.ts`, `apps/mobile/src/diag/__tests__/log.test.ts`

## Fora do escopo
Health e status do servidor (M4-05).

## Commit
`Add a never-throwing HTTP client with diagnostic logging`
