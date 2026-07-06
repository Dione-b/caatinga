# Conceptual Naming Policy

This document defines the official conceptual terminology for Caatinga to resolve generic names and clearly communicate package and module responsibilities. 

While package names on npm (`@caatinga/core`, `@caatinga/client`) remain unchanged to avoid breaking existing consumer integrations, all architecture diagrams, code comments, and documentation guides must adhere to this conceptual naming vocabulary.

---

## Terminology Mapping

| Package/Module Name | Generic Term | Conceptual Term | Responsibility Description |
| :--- | :--- | :--- | :--- |
| `@caatinga/core` | `core` | **Orchestration Engine** | The engine that compiles contracts, topological-sorts the dependency graph, resolves configuration variables, and executes deploy lifecycle hooks. |
| `@caatinga/client` | `client` | **Integration SDK** | The frontend/consumer library that provides wallet session bindings, wraps type-safe generated contract clients, and interacts with browser wallet adapters. |
| `packages/templates`| `templates` | **Project Scaffolds** | Pre-configured starter application templates (minimal, react-vite, zk) used to initialize projects. |
| `@caatinga/client` (internal) | `runtime` | **Transaction Pipeline** | The sequential execution pipeline: simulating transactions, signing via client-side wallets, submitting to the Horizon/Stellar network, and watching confirmation status. |

---

## Vocabulary Guidelines

1. **When talking about CLI or compile/deploy steps:**
   - *Avoid:* "Run the core to deploy", "Core builds the contracts".
   - *Prefer:* "The **Orchestration Engine** executes the build", "The deployment graph is handled by the **Orchestration Engine**".

2. **When talking about browser-side contract execution:**
   - *Avoid:* "Import the client", "Register a client adapter".
   - *Prefer:* "Initialize the **Integration SDK** client", "Utilize the **Integration SDK** wallet adapters".

3. **When talking about the transaction lifecycle:**
   - *Avoid:* "The client runtime handles the signature", "Runtime client calls simulate".
   - *Prefer:* "The **Transaction Pipeline** simulates and signs the transaction".

4. **When talking about templates:**
   - *Avoid:* "Scaffold using templates", "Available templates in packages".
   - *Prefer:* "Scaffold using the official **Project Scaffolds**".
