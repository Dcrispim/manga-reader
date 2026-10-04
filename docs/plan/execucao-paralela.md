# Execução paralela: ramos e linha do tempo

Complementa o `README.md`. Usa as dependências **declaradas** em cada etapa, mais os recursos compartilhados que impedem paralelismo mesmo sem dependência lógica.

## 1. Recursos compartilhados (o que trava paralelismo mesmo sem dependência lógica)

| Recurso | Etapas que usam | Regra |
|---|---|---|
| Porta **3994** (servidor de teste no host ou container efêmero) | M1-04, M1-06, M2-01, M2-06, M2-07, M2-09, M3-02, M3-04, M4-05, M4-06, M4-19 | Duas etapas na mesma onda usam portas diferentes: a primeira fica com 3994 e a segunda com 3995 (`smoke.sh` recebe a URL) |
| Nome do container `manga-reader-monorepo-test` | M1-06, M3-04, M4-19 | Nunca duas ao mesmo tempo (no plano, já não coincidem) |
| `pnpm-lock.yaml` e `package.json` | quase todas as que adicionam dependências | Em conflito de merge, **não** resolver à mão: aceitar um dos lados e rodar `pnpm install` |
| `packages/core/src/index.ts` | M2-05, M2-06, M2-07, M2-08, M4-07 | O conflito é só de linhas de export: manter as duas |
| `apps/server/next.config.ts` | M2-05, M3-01 | Etapas sequenciais, sem risco |
| `apps/mobile/app/_layout.tsx` | M4-03, M4-05, M4-08, M4-09, M4-13, M4-14 | No plano já são sequenciais |
| `apps/mobile/src/db/schema.ts` e migrações | M4-03, M4-11 | Sequenciais |
| `apps/mobile/app/dev.tsx` | M4-13, M4-16 | Paralelas: a M4-16 cria a seção "Spike SAF" num arquivo próprio, `app/dev-saf.tsx` |
| `apps/mobile/src/sync/cycle.ts` | M4-13, M4-17 | Sequenciais (a M4-17 vem depois) |
| Emulador e aparelho físico | M4-02 em diante, M4-16 (aparelho físico) | A M4-16 usa o **aparelho físico**; as demais, o emulador |
| Pessoa (você) | M4-01 (sudo), M4-16 (aparelho), M4-20 (keystore) | Agendar a disponibilidade |

## 2. Mecânica de git para etapas paralelas

- Cada etapa paralela roda num **worktree próprio** (`git worktree add ../mr-<etapa> -b step/<etapa> milestone/<marco>`).
- Ao final da onda, as `step/*` são mergeadas na `milestone/<marco>` **em ordem de id** (ex.: M2-03, M2-04, M2-05, M2-09), e os testes do marco rodam de novo depois de cada merge.
- A onda seguinte só começa depois do merge da anterior.

## 3. Ramos paralelos, por marco

```
Marco 1.1.0
  M1-01 → M1-02 → M1-03 → M1-04 ─┬─ M1-05 → M1-06 ─┐
                                 └─ M1-07 ──────────┴─→ M1-08

Marco 1.2.0
  M2-01 → M2-02 ─┬─ M2-03 ─┬───────────→ M2-06
                 ├─ M2-04 ─┘            ↗
                 ├─ M2-05 ──────┬──────┘
                 │              └─ (M2-03 + M2-05) → M2-07 → M2-08
                 └─ M2-09 (ramo independente, só precisa terminar antes do fim do marco)

Marco 1.3.0
  M3-01 → M3-02 → M3-03 → M3-04          (cadeia única; sem paralelismo interno)

Mobile v1
  M4-01 (ambiente, a qualquer momento antes da M4-02)
  M4-02 ─┬─ M4-03 → M4-04 → M4-05 ─┬─ M4-06 ─┐
         │                         │         ├─ M4-08 → M4-09 → M4-10 → M4-11 ─┐
         │        M4-07 ───────────┼─────────┘                                 │
         │                         └─ M4-12 ───────────────────────────────────┤
         └─ M4-16 (spike, aparelho físico) ────────────────────────┐           ↓
                                                                   │         M4-13 → M4-14 ─┬─ M4-15 ─┐
                                                                   └──────────────────────→ ├─ M4-17  ├→ M4-19 → M4-20
                                                                                            └─ M4-18 ─┘
```

Ramos independentes (fora do caminho crítico):
- **M1-07** (CI), em paralelo com M1-05 e M1-06.
- **M2-04**, **M2-05** e **M2-09**, em paralelo com M2-03.
- **M4-07** (política de espaço no core), que só precisa do core e pode ser antecipada.
- **M4-12** (histórico e bind), em paralelo com toda a trilha de armazenamento (M4-06 a M4-11).
- **M4-16** (spike do SAF), em paralelo com M4-03 a M4-15. **Convém fazer cedo**: se falhar, a M4-16b (módulo Kotlin) também precisa estar pronta antes da M4-17.
- **M4-15, M4-17 e M4-18**, em paralelo depois da M4-14.

## 4. Linha do tempo: modo estrito (respeita os portões de marco)

Cada marco do servidor só começa com o anterior **mergeado em `main`** (é o seu portão de revisão).

| Onda | Etapas (‖ = em paralelo) | Observação |
|---|---|---|
| 1 | M1-01 ‖ M4-01 | M4-01 é o ambiente Android (**você**: sudo) |
| 2 | M1-02 | |
| 3 | M1-03 | |
| 4 | M1-04 | porta 3994 |
| 5 | M1-05 ‖ M1-07 | |
| 6 | M1-06 | container de teste |
| 7 | M1-08 | **🚦 Portão 1.1.0**: você revisa e faz o merge |
| 8 | M2-01 | |
| 9 | M2-02 | |
| 10 | M2-03 ‖ M2-04 ‖ M2-05 ‖ M2-09 | M2-09 usa a porta 3994 |
| 11 | M2-06 ‖ M2-07 | smoke: M2-06 na 3994, M2-07 na 3995 |
| 12 | M2-08 | **🚦 Portão 1.2.0** |
| 13 | M3-01 ‖ M4-07 | M4-07 entra no branch mobile (base: 1.2.0) |
| 14 | M3-02 | |
| 15 | M3-03 | |
| 16 | M3-04 | **🚦 Portão 1.3.0** |
| 17 | M4-02 | |
| 18 | M4-03 ‖ M4-16 | M4-16: **você** conecta o aparelho físico |
| 19 | M4-04 | se o spike falhou: M4-16b entra aqui, em paralelo |
| 20 | M4-05 | |
| 21 | M4-06 ‖ M4-12 | |
| 22 | M4-08 | |
| 23 | M4-09 | |
| 24 | M4-10 | |
| 25 | M4-11 | |
| 26 | M4-13 | |
| 27 | M4-14 | |
| 28 | M4-15 ‖ M4-17 ‖ M4-18 | |
| 29 | M4-19 | definição de pronto |
| 30 | M4-20 | **você**: keystore e backup |

**30 ondas.** Caminho crítico: a cadeia do servidor (16 ondas) e depois M4-02 → 03 → 04 → 05 → 06 → 08 → 09 → 10 → 11 → 13 → 14 → 15 → 19 → 20.

## 5. Linha do tempo: modo acelerado (empilha branches entre marcos)

Usa as dependências **reais** em vez dos portões de marco:
- a M3-01 precisa só de M2-06 e M2-07, não da M2-08;
- a M4-02 precisa só de M4-01, M2-05 e M3-01;
- a M4-07 precisa só de M2-05;
- a M4-14 precisa de M4-06, M4-10 e M4-12, mas não da M4-13 (só a ligação no `_layout.tsx`, que pode ser ajustada no merge).

**Custo:** a branch do mobile passa a partir de branches de marco ainda não mergeadas (é preciso rebase quando você mergear), e um ajuste pedido na revisão de um marco pode respingar nas etapas seguintes.

| Onda | Etapas |
|---|---|
| 1–9 | iguais ao modo estrito |
| 10 | M2-03 ‖ M2-04 ‖ M2-05 ‖ M2-09 |
| 11 | M2-06 ‖ M2-07 ‖ M4-07 |
| 12 | M2-08 ‖ M3-01 |
| 13 | M3-02 ‖ M4-02 |
| 14 | M3-03 ‖ M4-03 ‖ M4-16 |
| 15 | M3-04 ‖ M4-04 |
| 16 | M4-05 |
| 17 | M4-06 ‖ M4-12 |
| 18 | M4-08 |
| 19 | M4-09 |
| 20 | M4-10 |
| 21 | M4-11 ‖ M4-14 |
| 22 | M4-13 ‖ M4-15 |
| 23 | M4-17 ‖ M4-18 |
| 24 | M4-19 |
| 25 | M4-20 |

**25 ondas** (−5). O ganho vem quase todo de começar o app enquanto o 1.3.0 ainda está em andamento.

## 6. Recomendação

Usar o **modo estrito** nos marcos do servidor, porque eles afetam o web que está em uso e os portões de revisão valem o custo. Do modo acelerado, aplicar só as antecipações **que não cruzam portão**:
- a M4-01 já na onda 1;
- a M4-16 assim que a M4-02 terminar;
- a M4-14 em paralelo com M4-11 e M4-13 (economiza 1 onda dentro do branch mobile).

Isso dá **29 ondas**, sem branches empilhadas.
