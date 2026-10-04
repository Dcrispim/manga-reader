# M4-16 — Spike: desempenho da varredura via SAF

**Marco:** mobile v1 · **Depende de:** M4-02, M2-08 (scanner do core)

## Objetivo
Medir num aparelho real quanto tempo leva a varredura completa de uma pasta local com ~2.000 capítulos via Storage Access Framework, usando o `expo-file-system`, e decidir com números se é preciso um módulo nativo em Kotlin.

## Contexto mínimo
- O app vai para a Play Store, então o acesso a pastas do aparelho é **via SAF** (o seletor de pasta do sistema, com permissão persistente sobre a árvore e URIs `content://`). `MANAGE_EXTERNAL_STORAGE` **não** pode ser usado.
- Escala no aparelho: até ~30 GB, ou seja, cerca de 2.000 capítulos, ~30 mil arquivos e algo como 100 títulos.
- O scanner do core (`scanLibrary(fs, root, opts)` em `@manga/core`) recebe um `FsAdapter { list(path), stat(path), readText(path) }`.
- **Critério:** a varredura completa leva **menos de 60 s** no aparelho mais lento disponível (celular ou tablet do usuário). Se passar, a decisão é escrever um módulo Expo nativo em Kotlin, com uma única `ContentResolver.query` por diretório que traga nome, mime, mtime e tamanho. O plano para isso vira uma etapa nova, M4-16b, a ser escrita com base nos números medidos.

## Início
- O app roda no emulador; um aparelho físico está conectado (`adb devices` lista).

## Meio
1. Gerar a biblioteca de teste: `scripts/mobile/make-saf-fixture.sh <dest>` (bash), criando 100 títulos × 20 capítulos × 15 arquivos `.jpg` de 1 KB, mais `.meta` e `.thumb` em alguns. Enviar com `adb push <dest> /sdcard/Download/manga-spike/`.
2. `apps/mobile/src/sources/safFs.ts`: um `FsAdapter` sobre as APIs SAF do `expo-file-system` (conferir na documentação do SDK atual qual API lista um diretório SAF e obtém o mtime e o tamanho, e se a API nova `Directory`/`File` aceita URIs `content://`). Os caminhos do core (`a/b/c`) são mapeados para URIs filhas.
3. Uma tela dev (`app/dev.tsx`, seção "Spike SAF"): escolher a pasta com o seletor, rodar `scanLibrary` com `onProgress` e mostrar o tempo total, o número de diretórios listados e o tempo médio por listagem. Rodar 3 vezes e anotar a mediana.
4. Registrar os resultados em `docs/mobile/spike-saf.md`: o aparelho (modelo e versão do Android), a API usada, as 3 medições, a mediana e a conclusão (passa ou falha no critério). Se falhar, incluir uma estimativa do ganho de uma consulta única por diretório.
5. Atualizar `docs/adr/0006-fontes-locais-saf.md` com o resultado.

## Fim
- `docs/mobile/spike-saf.md` existe, com as medições e uma conclusão explícita.
- O ADR 0006 foi atualizado.
- Se passou: o `safFs.ts` segue para M4-17. Se falhou: abrir a etapa M4-16b (módulo Kotlin) antes de M4-17 e **reportar ao usuário**.

## Arquivos
- Criar: `scripts/mobile/make-saf-fixture.sh`, `apps/mobile/src/sources/safFs.ts`, `docs/mobile/spike-saf.md`
- Modificar: `apps/mobile/app/dev.tsx`, `docs/adr/0006-fontes-locais-saf.md`

## Fora do escopo
Integrar as fontes locais ao catálogo (M4-17).

## Commit
`Spike SAF library scanning performance`
