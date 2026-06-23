# Early Adopter Outreach Template

Use this script to validate production usage and collect case study material. Target: GitHub stargazers, npm early adopters, Discord/Telegram contacts.

## Goals

1. Confirm whether anyone runs Caatinga in production (mainnet or long-lived testnet).
2. Collect contract count, network usage, and pain points.
3. Obtain permission for a public case study quote.

## Message template (email / DM)

```
Subject: Quick question about your Caatinga usage

Hi [name],

I noticed you [starred @caatinga/cli / downloaded the package / opened an issue].
I'm the maintainer and trying to understand real-world usage before v1.0.

Would you have 5 minutes for three questions?

1. Are you using Caatinga in a project today? (testnet / mainnet / prototype only)
2. How many Soroban contracts does the project deploy, and do you use dependsOn?
3. What broke or surprised you — Stellar CLI version, bindings, wallets, something else?

If you're open to it, I'd love a one-sentence quote for the README case study section
(with or without your project name).

Thanks,
[your name]
```

## Tracking sheet (maintainer)

| Contact | Channel | Response | Contracts | Network | Quote approved? |
| ------- | ------- | -------- | --------- | ------- | --------------- |
|         |         |          |           |         |                 |

## When you get a positive response

1. Create `docs/case-studies/<project-slug>.md` using the counter-web template.
2. Add a quote block to README under a **Built with Caatinga** section (only with explicit permission).
3. Update [production-readiness.md](../production-readiness.md) with any new operational lessons.

## What not to promise

- Do not promise features on a specific date in outreach.
- Do not imply mainnet readiness beyond the alpha status.
- Do not request private keys or deployment secrets.
