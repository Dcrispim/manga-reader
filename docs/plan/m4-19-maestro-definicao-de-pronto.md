# M4-19 — Fluxo Maestro: a definição de pronto

**Marco:** mobile v1 · **Depende de:** M4-14, M4-15, M4-18 (e M4-17, para o fluxo opcional de fonte local)

## Objetivo
Automatizar o critério de sucesso da v1: com o servidor fora do ar, o app fechado e reaberto abre, lista o catálogo e lê o capítulo baixado, **sem nenhuma tela ou mensagem de erro**, e o progresso sincroniza quando o servidor volta.

## Contexto mínimo
- Servidor de teste: o container efêmero `manga-reader:monorepo-test` na porta **3994**, com volumes `:ro` (comando no `00-contexto.md`, item 6). **Nunca** usar o container estável (3993) para isso, porque ele não pode ser parado.
- O emulador alcança o host em `10.0.2.2`, então o endereço no app é `10.0.2.2:3994`.
- Os 7 dias offline do critério não podem ser simulados por tempo. O fluxo prova que **não existe expiração**, e um grep garante que não há TTL de dados (passo 4).
- Textos de erro que **não** podem aparecer em nenhum momento: "Erro", "Error", "falhou", "Exception", "undefined", "null", "NaN".
- Maestro CLI instalado (M4-01). O app é instalado como development build ou como APK de release.

## Início
- M4-18 commitado.
- `docker build -t manga-reader:monorepo-test .` com o servidor 1.3.0+.

## Meio
1. `apps/mobile/.maestro/offline-first.yaml`:
   1. `clearState` e `launchApp`;
   2. a tela de Configurações aparece; digitar host `10.0.2.2` e porta `3994`; tocar em Testar conexão (espera "Conectado"); Salvar;
   3. esperar o catálogo: o Início mostra pelo menos 1 título (`extendedWaitUntil`, até 60 s);
   4. abrir o primeiro título e tocar em "Baixar" no primeiro capítulo; esperar o badge "baixado";
   5. `runScript` (ou um `runFlow` com um hook de shell através do script do passo 2) para **parar** o container de teste;
   6. `stopApp` e `launchApp`;
   7. assertivas: o Início mostra o mesmo título; abrir o título; abrir o capítulo baixado; ver a primeira página (`assertVisible` por `testID` da página 0);
   8. abrir um capítulo **não** baixado: o texto "não está disponível offline" e o botão "Baixar quando disponível" aparecem; tocar no botão;
   9. em todos os passos: `assertNotVisible` para cada texto proibido;
   10. subir o container de teste de novo; tocar em "Sincronizar agora" nas Configurações; esperar o job do passo 8 concluir.
2. `scripts/mobile/e2e.sh`: build da imagem, se faltar; sobe o container de teste; roda `maestro test apps/mobile/.maestro/offline-first.yaml` controlando a parada e a subida do container nos pontos marcados (via `maestro test` com variáveis de ambiente e `runScript`, ou dividindo o fluxo em três arquivos chamados em sequência pelo script); sempre derruba o container no final (`trap`).
3. Adicionar `testID` nos componentes que o fluxo usa: `page-0`, `title-card-<i>`, `chapter-row-<i>`, `download-button`, `status-pill` e `settings-host`/`port`/`test`/`save`.
4. Verificação de ausência de TTL: `grep -rniE "ttl|expire|maxAge|stale" apps/mobile/src` não encontra nenhuma lógica que descarte dados por idade (comentários explicativos são permitidos). Registrar o resultado em `docs/mobile/definition-of-done.md`.
5. Fluxo opcional `apps/mobile/.maestro/local-source.yaml` (se M4-17 estiver pronto): ler um capítulo de fonte local com o servidor parado.

## Fim
- `scripts/mobile/e2e.sh` termina com código 0 no emulador `manga_phone` e também no `manga_tablet`.
- O container de teste não fica rodando depois do script (`docker ps` sem `manga-reader-monorepo-test`).
- `docs/mobile/definition-of-done.md` descreve o fluxo, como rodar e o resultado.

## Arquivos
- Criar: `apps/mobile/.maestro/offline-first.yaml` (e as partes, se dividido), `apps/mobile/.maestro/local-source.yaml`, `scripts/mobile/e2e.sh`, `docs/mobile/definition-of-done.md`
- Modificar: os componentes que recebem `testID` (`apps/mobile/app/**`, `apps/mobile/src/ui/**`, `apps/mobile/src/reader/**`)

## Fora do escopo
Rodar o Maestro na CI.

## Commit
`Add the offline-first Maestro flow as the v1 definition of done`
