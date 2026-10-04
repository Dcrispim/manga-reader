# M4-01 — Toolchain Android no host

**Marco:** mobile v1 · **Depende de:** nada (pode rodar em paralelo aos marcos do servidor). **Pode exigir ação do usuário** (sudo).

## Objetivo
Deixar o host CachyOS capaz de compilar e rodar um app Expo (development build) num emulador Android e num aparelho físico via USB.

## Contexto mínimo
- Host: CachyOS (Arch), shell fish, Node v24 via nvm. Hoje **não** há `java` nem `adb`.
- O Expo SDK estável atual pede JDK 17 e Android SDK com platform-tools, build-tools e uma imagem de sistema para o emulador. Conferir a versão exigida em https://docs.expo.dev/get-started/set-up-your-environment/ (Android, development build, local).

## Início
- `which java adb` não encontra nada.

## Meio
1. Instalar o JDK 17: `sudo pacman -S --needed jdk17-openjdk` e `sudo archlinux-java set java-17-openjdk`. Se não houver permissão de sudo, **parar e pedir ao usuário** que rode `! sudo pacman ...`.
2. Instalar as cmdline-tools do Android SDK em `~/Android/Sdk` (zip oficial do Google, em `cmdline-tools/latest/`), sem Android Studio.
3. Variáveis no fish (`~/.config/fish/conf.d/android.fish`): `ANDROID_HOME=~/Android/Sdk` e PATH com `$ANDROID_HOME/platform-tools`, `$ANDROID_HOME/emulator` e `$ANDROID_HOME/cmdline-tools/latest/bin`.
4. `sdkmanager --licenses` (aceitar) e `sdkmanager "platform-tools" "emulator" "platforms;android-<API alvo do SDK Expo>" "build-tools;<versão>" "system-images;android-<API>;google_apis;x86_64"`.
5. Criar o AVD: `avdmanager create avd -n manga_phone -k "system-images;android-<API>;google_apis;x86_64" -d pixel_7`, e um segundo, `manga_tablet`, com o device `pixel_tablet`.
6. KVM: conferir `ls -l /dev/kvm` e se o usuário está no grupo `kvm`.
7. Instalar o Maestro CLI (`curl -fsSL "https://get.maestro.mobile.dev" | bash`) e conferir com `maestro --version`.
8. Registrar em `docs/mobile/toolchain.md` as versões instaladas e os comandos de boot (`emulator -avd manga_phone -no-snapshot-save &`).

## Fim
- `java -version` mostra 17.
- `adb version` funciona.
- `emulator -avd manga_phone` inicializa, e `adb shell getprop sys.boot_completed` mostra `1`.
- `maestro --version` funciona.
- `docs/mobile/toolchain.md` existe.

## Arquivos
- Criar: `docs/mobile/toolchain.md` (no repo), `~/.config/fish/conf.d/android.fish` (fora do repo)

## Fora do escopo
Keystore de release (M4-22).

## Commit
`Document the Android toolchain setup`
