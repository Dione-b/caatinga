# Caatinga × Radox — Gap Analysis

> Auditoria de funcionalidades que o Radox já possui manualmente e que o Caatinga
> ainda não suporta ou suporta parcialmente.
>
> **Escopo:** apenas ambiente de desenvolvimento (testnet).
> **Data:** 2026-06-28

---

## 1. Visão Geral

O Caatinga é um toolkit CLI + client para ciclo de vida de contratos Soroban:
scaffold → build → deploy → generate bindings → invoke/read, com comandos
adicionais para setup, wire (pós-deploy), sync-env, inspect, status, doctor,
migrate, rollback, e estimate.

O Radox é uma plataforma de security tokens com 3 contratos Soroban (TokenSale v7,
YieldDistributor v3, MaturitySettlement v3) orquestrados por um backend Node.js que
assina transações com chaves de operação via Docker secrets.

**Conclusão resumida:** Caatinga é adequado para build, deploy singleton (YieldDistributor),
geração de bindings TypeScript, e orquestração pós-deploy (wire + sync-env).
Para contratos per-offer (TokenSale, MaturitySettlement), deploy com assinatura de
backend, e operações multi-step com assinaturas diferentes, o Radox tem necessidades
que o Caatinga atual não atende.

---

## 2. Gaps Detalhados

### Gap 1: Build com Cargo features por contrato

**Status:** ✅ Resolvido (v3.5.1)

Caatinga agora suporta `buildFeatures` por contrato:

```ts
contracts: {
  token_sale: {
    path: './contracts/token_sale',
    wasm: '...',
    buildFeatures: ['--no-default-features', '--features', 'testnet'],
  },
}
```

`stellar contract build` recebe `--features` / `--no-default-features` como argumentos diretos.

---

### Gap 2: Contratos per-offer com salt determinístico

**Status:** Não suportado

**O que o Radox faz:**
TokenSale e MaturitySettlement são instanciados **uma vez por oferta** com salts
determinísticos baseados no offerId e WASM hash:

```js
// TokenSale — salt WASM-version-aware
SorobanSaleService.saleSalt(offerId, wasmHash);
// = sha256("radox:sale:{offerId}:{wasmHash}")

// MaturitySettlement — salt com timestamp
Buffer.from(hash(Buffer.from(`settlement-${offerId}-${Date.now()}`)));
```

O contractId é precomputado offline via `precomputeContractId(issuer, salt)`:

```js
SorobanSaleService.precomputeContractId(issuerPublicKey, salt);
// = sha256(networkId || deployer || salt)
```

**O que o Caatinga faz:**
Gerencia instância única por nome de contrato. `caatinga deploy token_sale`
criaria uma única instância com salt aleatório. Não existe conceito de
"template WASM" com múltiplas instâncias.

**Impacto:** Caatinga não pode orquestrar o fluxo per-offer deploy do TokenSale.
O backend continuará usando `SorobanSaleService.buildDeployXdr()` com salts
determinísticos.

**Sugestão de implementação:**
Não aplicável para Caatinga (deploy per-offer é orquestração de negócio).
Caatinga poderia fornecer `caatinga generate-salt` como utilitário CLI.

---

### Gap 3: WASM hash export para env vars do backend

**Status:** ✅ Resolvido (v3.5.1)

`caatinga sync-env` agora suporta mapeamentos `.wasmHash`:

```ts
frontend: {
  envFile: '.env',
  env: {
    token_sale: 'SALE_CONTRACT_ID',
    'token_sale.wasmHash': 'SALE_WASM_HASH',
  },
}
```

Sufixos reconhecidos: `.contractId` (default), `.wasmHash`, `.deployedAt`, `.wasmPath`.

---

### Gap 4: Deploy com chave de operação via Docker secret

**Status:** Não suportado (por design)

**O que o Radox faz:**
Em produção, o deploy é assinado por chave de operação armazenada em
Docker secret (`/run/secrets/operations_key`):

```js
const opsSecret = readFileSync("/run/secrets/operations_key", "utf8").trim();
const operations = Keypair.fromSecret(opsSecret);
```

**O que o Caatinga faz:**
`--source` aceita apenas alias de identidade Stellar CLI (`alice`, `bob`).
Nunca aceita S... secret key diretamente (erro `CAATINGA_SOURCE_IS_SECRET_KEY`).

**Impacto:** Irrelevante para dev/testnet. Para mainnet, o deploy continua
sendo feito pelo backend ou script dedicado.

---

### Gap 5: Admin transfer pós-deploy (propose + accept)

**Status:** ✅ Resolvido (v3.5.1)

`postDeploy` agora suporta `source` override por hook:

```ts
postDeploy: [
  { contract: "yield_distributor", method: "initialize", args: { admin: "${source.address}" } },
  {
    contract: "yield_distributor",
    method: "propose_admin",
    source: "issuer",
    args: { new_admin: "${contracts.issuer.address}" },
  },
];
```

**Limitação restante:**

- `accept_admin` requer delay de 24h e assinatura de chave diferente — não automatizável via `postDeploy`.

---

### Gap 6: Multi-batch distribution com Redis lock

**Status:** Não suportado

**O que o Radox faz:**
`YieldDistributorService.submitBatches()`:

- Divide investidores em batches de até 30
- Usa Redis lock para concorrência (`yield-dist-lock`)
- Retry com backoff exponencial (3 tentativas)
- Tracking de batch no Redis (`yield-dist:{offerId}:{batchId}`)

**O que o Caatinga faz:**
`caatinga invoke` executa uma chamada single-call. Não há conceito de
batching, locks, ou retry distribuído.

**Impacto:** Distribuição de yield continua exclusivamente no backend.

---

### Gap 7: Per-offer deploy via API REST

**Status:** Não suportado

**O que o Radox faz:**
Fluxo completo via HTTP:

```
POST /api/admin/offers/{id}/deploy-settlement
POST /api/admin/offers/{id}/init-settlement
```

O backend orquestra:

1. Verifica pré-requisitos (token SAC existente, maturityDate definida)
2. Build deploy XDR com salt determinístico
3. Submete via TransactionManager (Freighter multisig)
4. Após confirmação, build initialize XDR
5. Atualiza registro no banco (Prisma)

**O que o Caatinga faz:**
CLI interativo. Não há integração com APIs REST ou orquestração de backend.

**Impacto:** Deploy per-offer continua sendo feito via API do backend.

---

### Gap 8: Network feature gates na config

**Status:** ✅ Resolvido (v3.5.1)

Derivado do Gap 1. `buildFeatures` pode ser configurado por contrato para ativar features específicas por rede:

```ts
contracts: {
  token_sale: {
    buildFeatures: ['--no-default-features', '--features', 'testnet'],
  },
}
```

---

### Gap 9: Precomputação de contractId offline

**Status:** Não suportado

**O que o Radox faz:**
O backend precomputa o contractId antes do deploy para atualizar o banco
de dados imediatamente:

```js
const contractId = SorobanSaleService.precomputeContractId(issuerPublicKey, salt);
await prisma.offer.update({
  where: { id: offer.id },
  data: { sorobanContractId: contractId, sorobanInitStatus: "deploying" },
});
```

Além disso, verifica existência on-chain via `getLedgerEntries`
(cheque de crash recovery).

**O que o Caatinga faz:**
O contractId é descoberto após o deploy on-chain. Não há
precomputação ou verificação de existência pré-deploy.

**Impacto:** Irrelevante para Caatinga (contratos singleton).
Para per-offer, o backend continua responsável.

---

### Gap 10: Frontend já usa stack de wallet própria

**Status:** Concorrência de abstração

**O que o Radox faz:**
O frontend já tem integração completa com Stellar wallets:

- `@stellar/freighter-api` — para Freighter
- `smart-account-kit` (vendored) — para passkeys/WebAuthn
- `WalletProvider` customizado em `frontend/src/`
- Hook `useWallet()` próprio

**O que o Caatinga oferece:**
`@caatinga/client/react` com `WalletProvider` + `useWallet()` próprios,
adaptadores para Freighter e Stellar Wallets Kit.

**Impacto:** Migrar para Caatinga client seria refactor opcional.
Coexistência é possível — usar Caatinga bindings para invoke/read
e manter o wallet provider existente.

**Recomendação:** Não migrar o wallet provider. Usar Caatinga apenas
para bindings TypeScript e `read()` / `simulate()`.

---

### Gap 11: Transações assinadas com passkey + smart account

**Status:** Não suportado

**O que o Radox faz:**
Investidores assinam transações Soroban via passkey (WebAuthn) em
smart accounts contract-controlled:

```js
// passkeyWallet.service.js
const result = await PasskeyWalletService.sendTransaction(tx);
```

O backend orquestra a assinatura via challenge Redis,
e submete via fee-bump com a chave de operação.

**O que o Caatinga faz:**
`invoke()` assina com uma wallet adapter (Freighter/Ledger).
Não há suporte a passkeys/WebAuthn ou smart account signing.

**Impacto:** Fluxo de investidor (trade via passkey) continua
sendo orquestrado pelo backend.

---

### Gap 12: Fluxo multi-sig com Freighter/Ledger

**Status:** Não suportado

**O que o Radox faz:**
Admin operations (upgrade, withdraw, drain) requerem multi-sig:

```js
// multiSigTransaction.service.js
case 'sale_deploy':
  const salt = SorobanSaleService.saleSalt(metadata.offerId, wasmHash2);
  result = await SorobanSaleService.buildDeployXdr(issuerPk, wasmHash2, salt);
```

O TransactionManager gerencia proposta → aprovação → execução.

**O que o Caatinga faz:**
`CAATINGA_MULTI_AUTH_REQUIRED` — multi-signer não suportado até v1.0.

**Impacto:** Deploy via multisig continua no backend.

---

### Gap 13: Verificação pós-deploy (simulate reads)

**Status:** ✅ Resolvido (v3.5.1)

`postDeploy` agora suporta `expect` para asserção pós-invoke:

```ts
postDeploy: [
  { contract: "yield_distributor", method: "initialize", args: { admin: "${source.address}" } },
  { contract: "yield_distributor", method: "get_admin", expect: "${source.address}" },
];
```

Se o stdout não bate com `expect`, lança `CAATINGA_POST_DEPLOY_VERIFY_FAILED`.

---

### Gap 14: WASM hash management (upload sem deploy)

**Status:** Não suportado

**O que o Radox faz:**
O WASM é uploaded separadamente do deploy. O hash fica em env var
e é reutilizado para múltiplos deploys:

```bash
# Upload (uma vez)
stellar contract upload --wasm token_sale.mainnet.wasm

# Deploy (N vezes, com salts diferentes)
SALE_WASM_HASH=<hex>  # usado por buildDeployXdr
```

**O que o Caatinga faz:**
`caatinga build` → `caatinga deploy` é pipeline acoplado.
Não há separação entre upload de WASM e deploy de instância.

**Impacto:** Para per-offer, o Radox precisa de upload único + N deploys.
Caatinga não suporta este padrão.

---

### Gap 15: Crash recovery e idempotência

**Status:** Parcialmente suportado

**O que o Radox faz:**
`offer.service.js` implementa crash recovery completo:

```js
const alreadyDeployed = await SorobanSaleService.contractExistsOnChain(precomputedId);
if (alreadyDeployed && wasmMatches) {
  // Pular deploy, ir direto para create()
}
```

Verifica se o contrato já existe on-chain e se o WASM hash confere.
Se o deploy foi interrompido, retoma do ponto certo.

**O que o Caatinga faz:**

- **Retry com backoff exponencial:** deploy tenta novamente em caso de
  falha transiente (TxBadSeq, timeouts, connection resets) com delays
  padrão de 2s/5s (3 tentativas).
- **Recuperação de contractId:** após falha, tenta recuperar o
  contractId da transação on-chain via `tryRecoverContractIdFromDeployFailure()`,
  evitando redeploy desnecessário.
- **Skip se já deployado:** se o artifact já existe com contractId
  (e `--force` não foi passado), pula o deploy (`skipped: true`).
- **Verificação pré-deploy on-chain:** não há verificação de existência
  on-chain (apenas verificação de artifact local) nem comparação de
  WASM hash com o estado on-chain.

**Impacto:** Para singleton (YieldDistributor), Caatinga tem crash
recovery básico (retry + recovery de contractId). Para per-offer
(TokenSale/MaturitySettlement), onde o deploy é orquestrado pelo
backend com precomputação de contractId, o backend continua
responsável pelo crash recovery completo.

---

## 3. Resumo das Capacidades

| Capacidade                             | Caatinga                                    | Radox Manual                                |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Build WASM (features default)          | ✅ `caatinga build`                         | ✅ `cargo build` + `stellar contract build` |
| Build WASM (features por rede)         | ✅ `buildFeatures` por contrato             | ✅ `--features testnet/mainnet`             |
| Deploy singleton                       | ✅ `caatinga deploy`                        | ✅ Script `deploy-yield-distributor.mjs`    |
| Deploy per-offer (salt determinístico) | ❌ Gap 2                                    | ✅ `SorobanSaleService.buildDeployXdr()`    |
| Deploy retry + recovery                | ✅ Retry backoff + contractId recovery      | ✅ `contractExistsOnChain()`                |
| WASM hash em `status --json`           | ✅ `caatinga status --json`                 | ⚠️ Manual                                   |
| WASM hash → env var                    | ✅ `sync-env` com `.wasmHash`               | ✅ Deploy script imprime `WASM_HASH=`       |
| Deploy com Docker secret               | ❌ Gap 4                                    | ✅ `/run/secrets/operations_key`            |
| Admin transfer multi-step              | ✅ `source` override por hook               | ✅ Script dedicado                          |
| Multi-batch distribution               | ❌ Gap 6                                    | ✅ `submitBatches()` + Redis                |
| Per-offer deploy via API               | ❌ Gap 7                                    | ✅ `POST /api/admin/offers/{id}/deploy-*`   |
| Network feature gates (build)          | ✅ `buildFeatures` por contrato             | ✅ Cargo features                           |
| Precomputação de contractId            | ❌ Gap 9                                    | ✅ `precomputeContractId()`                 |
| Geração de TS bindings                 | ✅ `caatinga generate`                      | ❌ Manual/inexistente                       |
| Client browser (invoke/read/simulate)  | ✅ `@caatinga/client`                       | ✅ `@stellar/stellar-sdk` direto            |
| Wallet provider React                  | ✅ `@caatinga/client/react`                 | ✅ Provider customizado                     |
| Stellar Wallets Kit adapter            | ✅ Modal + WalletConnect                    | ❌ Apenas Freighter                         |
| Passkey/WebAuthn signing               | ❌ Gap 11                                   | ✅ `passkeyWallet.service.js`               |
| Multi-sig (Freighter/Ledger)           | ❌ Gap 12                                   | ✅ `multiSigTransaction.service.js`         |
| Verify pós-deploy (simulate)           | ✅ `expect` em postDeploy                   | ✅ Simulate + asserts customizados          |
| Upload WASM sem deploy                 | ❌ Gap 14                                   | ✅ Separado                                 |
| Crash recovery (básico)                | ⚠️ Parcial (Gap 15)                         | ✅ `contractExistsOnChain()`                |
| Post-deploy wire (array hooks)         | ✅ `caatinga wire` + auto após deploy       | ✅ Scripts dedicados                        |
| Frontend env sync                      | ✅ `caatinga sync-env`                      | ⚠️ Manual                                   |
| Status / diagnostics                   | ✅ `caatinga status` / `doctor` / `inspect` | ⚠️ Manual                                   |
| Setup automatizado                     | ✅ `caatinga setup`                         | ❌ N/A                                      |

---

## 4. Recomendação de Uso

### Usar Caatinga para:

1. **Build de YieldDistributor** (sem feature gates)
2. **Build de TokenSale/MaturitySettlement** com `buildFeatures` para features por rede
3. **Deploy de YieldDistributor** em testnet (singleton, com retry + recovery)
4. **Geração de bindings TypeScript** para o frontend
5. **`caatinga read`** para testes interativos (simulate sem assinar)
6. **`caatinga status` / `caatinga doctor` / `caatinga inspect`** para diagnóstico
7. **`caatinga wire`** para pós-deploy (init, set_admin, etc.) — multi-step sequencial com `source` override por hook
8. **`caatinga sync-env`** para sincronizar contract IDs e WASM hashes com frontend `.env`
9. **`caatinga setup`** para bootstrap de ambiente (Node, Rust, Stellar CLI, identidade)
10. **Client browser (`@caatinga/client`)** para invoke/read com Freighter ou Stellar Wallets Kit
11. **Verificação pós-deploy** via `expect` em postDeploy hooks

### Não usar Caatinga para:

1. **Build de TokenSale/MaturitySettlement** sem `buildFeatures` (requer features)
2. **Deploy per-offer** (requer salt determinístico + backend signing)
3. **Distribuição de yield** (requer batching + Redis)
4. **Fluxo de investidor** (requer passkey signing)
5. **Operações admin** (requer multi-sig)
6. **Produção/mainnet** (continua com backend + Docker secrets)

### Coexistência:

- Caatinga gera bindings → frontend importa via `@caatinga/client`
- Backend continua orquestrando deploy/invoke per-offer
- Wallet provider existente permanece (não migrar para Caatinga)
- `@caatinga/client` com Stellar Wallets Kit pode coexistir com provider customizado

---

## 5. Prioridades de Implementação (para o Caatinga)

| Prioridade | Gap                                     | Esforço estimado | Impacto                                             |
| ---------- | --------------------------------------- | ---------------- | --------------------------------------------------- |
| ✅         | Gap 1 — Build features por contrato     | Baixo            | Resolvido em v3.5.1                                 |
| ✅         | Gap 8 — Network feature gates na config | Baixo            | Resolvido em v3.5.1                                 |
| ✅         | Gap 5 — postDeploy source override      | Baixo            | Resolvido em v3.5.1                                 |
| ✅         | Gap 3 — WASM hash em `sync-env`         | Baixo            | Resolvido em v3.5.1                                 |
| ✅         | Gap 13 — postDeployVerify asserts       | Médio            | Resolvido em v3.5.1                                 |
| P2         | Gap 2 — Contratos per-offer             | Alto             | Não aplicável (per-offer = backend)                 |
| P2         | Gap 9 — Precomputação contractId        | Alto             | Não aplicável (per-offer = backend)                 |
| P2         | Gap 14 — Upload WASM separado           | Médio            | Não aplicável (per-offer = backend)                 |
| P2         | Gap 15 — Crash recovery on-chain        | Médio            | Já tem retry + recovery; falta verificação on-chain |
| P3         | Gap 4 — Docker secret signing           | N/A              | Por design (dev only)                               |
| P3         | Gap 6 — Multi-batch distribution        | N/A              | Backend only                                        |
| P3         | Gap 7 — API REST deploy                 | N/A              | Backend only                                        |
| P3         | Gap 11 — Passkey signing                | N/A              | Backend only                                        |
| P3         | Gap 12 — Multi-sig                      | N/A              | Backend only                                        |
