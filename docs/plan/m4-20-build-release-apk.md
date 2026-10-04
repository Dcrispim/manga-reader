# M4-20 — Build de release local, keystore e instalação no aparelho

**Marco:** mobile v1 (fecha a v1) · **Depende de:** M4-19. **Exige ação do usuário** (o backup da keystore e a senha).

## Objetivo
Gerar um APK de release assinado, construído localmente, instalável no celular e no tablet, com a keystore guardada fora do repositório e com backup confirmado pelo usuário.

## Contexto mínimo
- O build é **local** (nada sobe para a nuvem do Expo). Ferramentas: o JDK 17 e o Android SDK (M4-01), mais o `npx expo prebuild` e o Gradle, ou `eas build --local -p android`.
- Pacote: `com.dcrispim.mangareader`.
- A keystore **nunca** entra no git. Ela fica em `~/.config/manga-reader/release.keystore`, e as senhas ficam em `~/.gradle/gradle.properties` (fora do repo). Quando o app for para a Play Store, essa chave vira a *upload key* (Play App Signing).
- Perder a keystore impede atualizar o app sem desinstalar, e desinstalar **apaga os downloads**. Por isso o backup é obrigatório antes de distribuir.
- Versão do app: `version` em `app.json` = `1.0.0` e `android.versionCode` = 1, com incremento a cada build distribuído.

## Início
- M4-19 passou.
- `ls ~/.config/manga-reader/release.keystore` não existe, ou o usuário confirma que já existe e onde está o backup.

## Meio
1. Gerar a keystore (se não existir): `keytool -genkeypair -v -storetype PKCS12 -keystore ~/.config/manga-reader/release.keystore -alias manga-reader -keyalg RSA -keysize 2048 -validity 10000`. **A senha é digitada pelo usuário.** Pedir que ele rode o comando com `! keytool ...` e nunca registrar a senha em arquivo do repositório.
2. **Parar e pedir ao usuário** que faça o backup da keystore e da senha fora da máquina (por exemplo, num gerenciador de senhas) e confirme por escrito. Sem essa confirmação, não seguir.
3. `~/.gradle/gradle.properties` (fora do repo): `MANGA_UPLOAD_STORE_FILE`, `MANGA_UPLOAD_KEY_ALIAS`, `MANGA_UPLOAD_STORE_PASSWORD` e `MANGA_UPLOAD_KEY_PASSWORD`. O usuário preenche as senhas.
4. Configurar a assinatura de release sem editar o `android/` gerado à mão: criar um config plugin local `apps/mobile/plugins/withReleaseSigning.js` que injeta o `signingConfigs.release` no `app/build.gradle`, lendo essas propriedades, e registrá-lo no `app.json`. Se as propriedades não existirem, o build de release falha com uma mensagem clara.
5. `scripts/mobile/build-release.sh`: roda `pnpm --filter @manga/mobile exec expo prebuild -p android --clean`, depois `cd apps/mobile/android && ./gradlew assembleRelease`, e copia o APK para `dist/mobile/manga-reader-<versão>-<versionCode>.apk` (ignorado pelo git).
6. Instalar no aparelho: `adb install -r dist/mobile/*.apk`. Atualizar com o mesmo comando, sem desinstalar.
7. `docs/mobile/release.md`: como gerar, onde está a keystore (sem segredos), o checklist do backup, o incremento do `versionCode`, a instalação e os pré-requisitos futuros da Play Store (a política de privacidade "nenhum dado sai do seu servidor"; a declaração do tráfego cleartext para a rede local; um AAB em vez de APK: `./gradlew bundleRelease`).

## Fim
- `scripts/mobile/build-release.sh` gera o APK.
- `apksigner verify --print-certs dist/mobile/*.apk` mostra o certificado da keystore criada.
- O APK instala e abre no celular e no tablet do usuário, e o fluxo manual de M4-19 (configurar o IP do servidor real na rede local) funciona.
- `git status` não mostra a keystore nem o `gradle.properties`.
- O usuário confirmou o backup da keystore.

## Arquivos
- Criar: `apps/mobile/plugins/withReleaseSigning.js`, `scripts/mobile/build-release.sh`, `docs/mobile/release.md`
- Modificar: `apps/mobile/app.json`, `.gitignore` (`dist/mobile/`, `*.keystore`)

## Fora do escopo
Publicar na Play Store.

## Commit
`Add local release build with external signing config`

> Fim da v1 do app.
