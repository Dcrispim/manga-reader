# M1-02 — Remover o Electron

**Marco:** 1.1.0 · **Depende de:** M1-01

## Objetivo
Apagar o wrapper Electron, que não é usado, sem afetar o build web.

## Contexto mínimo
Arquivos do Electron na raiz de `<repo>`: `electron/` (com `package.json` próprio, nome `chap-find-electron`), `main.js`, `preload.js`. O `.dockerignore` tem uma linha `electron`. O `package.json` raiz **não** referencia o Electron.

## Início
- Branch atual `milestone/1.1.0`, árvore limpa.
- `ls <repo>/electron <repo>/main.js <repo>/preload.js` existe.

## Meio
1. `git rm -r electron main.js preload.js`.
2. Remover a linha `electron` do `.dockerignore`.
3. `grep -rn "electron\|preload" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .` — se aparecer referência em código ou config (fora de lockfiles), remover. Se aparecer em lógica de app, **parar e reportar**.
4. `npm run build`.

## Fim
- Os três caminhos não existem mais.
- O grep do passo 3 não retorna nada fora de `package-lock.json`/`yarn.lock`.
- `npm run build` termina com código 0.

## Arquivos
- Remover: `electron/`, `main.js`, `preload.js`
- Modificar: `.dockerignore`

## Fora do escopo
Mudar dependências ou lockfiles.

## Commit
`Remove unused Electron wrapper`
