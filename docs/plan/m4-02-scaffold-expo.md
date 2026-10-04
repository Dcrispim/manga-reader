# M4-02 — Scaffold do `apps/mobile` (Expo, development build)

**Marco:** mobile v1 · **Depende de:** M4-01 e o marco 1.3.0 concluído

## Objetivo
Criar o app Expo no monorepo, com expo-router, TypeScript, Jest e os pacotes internos resolvendo pelo Metro, rodando como development build no emulador.

## Contexto mínimo
- Monorepo pnpm (`pnpm-workspace.yaml` já inclui `apps/*`). Os pacotes internos `@manga/core` e `@manga/api-contract` exportam TS-fonte (`./src/index.ts`).
- O servidor usa React 19.0 (Next 15). O Expo exige a versão de React do SDK dele. Com o linker isolado do pnpm (o padrão), cada app tem a sua cópia: **não** forçar versões iguais.
- Requisitos do app: development build (sem Expo Go); HTTP cleartext liberado (o servidor é `http://<ip-da-rede-local>:3993`); somente Android.
- Pacote Android: **`com.dcrispim.mangareader`**. Ele não pode mudar depois da primeira publicação na Play Store. Se o usuário ainda não confirmou o id, **perguntar antes**.

## Início
- `pnpm test` na raiz passa; o emulador `manga_phone` inicializa.

## Meio
1. `cd apps && pnpm dlx create-expo-app@latest mobile --template default` (TypeScript com expo-router). Apagar o `.git` que o template criar, se houver, e as telas de exemplo do template, mantendo só `app/_layout.tsx` e `app/index.tsx`.
2. `apps/mobile/package.json`: `"name": "@manga/mobile"`; dependências `@manga/core` e `@manga/api-contract` como `workspace:*`; scripts `start` (`expo start --dev-client`), `android` (`expo run:android`), `test` (`jest`), `typecheck` (`tsc --noEmit`) e `lint` (`expo lint`).
3. `npx expo install expo-dev-client expo-build-properties`. No `app.json`/`app.config.ts`: `name` "Manga Reader", `slug` "manga-reader", `android.package` igual a `com.dcrispim.mangareader`, `platforms: ["android"]` e o plugin `expo-build-properties` com `android.usesCleartextTraffic: true`.
4. Metro: o SDK atual detecta monorepos sozinho. Só criar o `metro.config.js` com `getDefaultConfig(__dirname)` se o bundle falhar ao resolver `@manga/*`. Se o Metro reclamar de symlinks ou de React duplicado, aplicar a receita oficial de monorepo para pnpm da documentação do Expo e **registrar o motivo** em `docs/mobile/monorepo.md`.
5. Jest: `npx expo install jest-expo jest @types/jest`; `"jest": { "preset": "jest-expo" }`; `transformIgnorePatterns` liberando `@manga/.*`.
6. `app/index.tsx` mostra `CORE_VERSION` importado de `@manga/core` (prova de resolução).
7. `src/__tests__/smoke.test.ts` importa algo de `@manga/core` e de `@manga/api-contract`.
8. `.gitignore`: `apps/mobile/android/` e `apps/mobile/ios/` (gerados pelo prebuild), `.expo/`.
9. `pnpm --filter @manga/mobile android` com o emulador ligado.

## Fim
- O app abre no emulador e mostra o número do `CORE_VERSION`.
- `pnpm --filter @manga/mobile test` e `typecheck` passam.
- `pnpm test` na raiz continua passando.
- `pnpm --filter @manga/server build` continua passando (sem conflito de React).

## Arquivos
- Criar: `apps/mobile/**` (template), `docs/mobile/monorepo.md` (se houver ajuste no Metro)
- Modificar: `.gitignore`, `pnpm-lock.yaml`, `.dockerignore` (já ignora `apps/mobile`; conferir)

## Fora do escopo
Telas reais e banco.

## Commit
`Scaffold the Expo mobile app in apps/mobile`
