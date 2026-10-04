# Definição de pronto da v1 (E2E offline-first)

Critério: com o servidor fora do ar, o app fechado e reaberto abre, lista o catálogo e lê o capítulo baixado, sem nenhuma tela ou mensagem de erro; o progresso e a fila voltam a andar quando o servidor retorna.

## O fluxo

`apps/mobile/.maestro/offline-first.yaml` (sub-fluxo `no-errors.yaml`, ajudante `control.js`):

1. `clearState` + `launchApp`; as Configurações abrem sozinhas; host `10.0.2.2`, porta `3994`, "Testar conexão" (espera "Conectado"), "Salvar".
2. O catálogo chega (até 60 s); abre o primeiro título e baixa o primeiro capítulo; espera o badge "baixado".
3. O servidor de teste é **parado**; o app é fechado (`stopApp`) e reaberto.
4. O Início mostra o mesmo título; o capítulo baixado abre e a página 0 (`page-0`) aparece.
5. Um capítulo não baixado mostra "Este capítulo não está disponível offline"; "Baixar quando disponível" entra na fila ("Na fila de download").
6. O servidor **volta**; "Sincronizar agora" nas Configurações; o job termina e o capítulo vira "baixado".

Em todos os pontos, `no-errors.yaml` afirma que não aparece nenhum de: Erro, Error, Exception, falhou, undefined, null, NaN.

O Maestro não executa shell. Por isso `scripts/mobile/e2e.sh` sobe um servidor HTTP mínimo em `127.0.0.1:3995` que só aceita `/stop` e `/start` sobre o container `manga-reader-monorepo-test`, e o fluxo o chama via `runScript` (`control.js`).

## Como rodar

```bash
# emulador já aberto e app instalado (ou APK=... para instalar antes)
ANDROID_SERIAL=emulator-5554 scripts/mobile/e2e.sh
# opcional: APK=apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

O APK de release (bundle embutido, assinado com a chave debug) sai de `cd apps/mobile/android && ./gradlew assembleRelease` após `expo prebuild`. O script usa só o container `manga-reader-monorepo-test` (porta 3994, volumes `:ro`, `serverId` persistido em `/mnt/d/manga-reader-tests/server-id`), builda a imagem `manga-reader:monorepo-test` se faltar e sempre para e remove o container no `trap`. O container estável (3993) nunca é tocado. Relatório JUnit em `/mnt/d/manga-reader-tests/M4-19/`.

## Sem expiração por tempo

Os 7 dias offline não são simuláveis; o fluxo prova que nada depende de rede ao reabrir, e a busca abaixo prova que não há TTL de dados:

```
grep -rniE "ttl|expire|maxAge|stale" apps/mobile/src   (excluindo __tests__)
```

Resultado (2026-10-04): nenhuma ocorrência. Não existe lógica que descarte dados por idade.

## Resultado

| Emulador | Resultado | Duração |
| --- | --- | --- |
| manga_phone (Pixel 7, API 36) | Passed | 2m38s |
| manga_tablet (Pixel Tablet, API 36) | Passed | 2m38s |

`docker ps` após cada execução: sem `manga-reader-monorepo-test`.

## Pendente

- `apps/mobile/.maestro/local-source.yaml` (ler capítulo de fonte local com o servidor parado): depende da M4-17, que ainda não existe.
- O Maestro não roda na CI.
