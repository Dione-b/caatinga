# Soroban types in TypeScript bindings

Stellar CLI TypeScript bindings map Soroban host types to familiar JavaScript types. Most mappings are intuitive, but **`Symbol` is a common footgun**.

## Symbol vs string

On Soroban, `Symbol` is a host type with strict character rules:

- Allowed: ASCII letters, digits, and underscores (`[A-Za-z0-9_]`).
- Not allowed: spaces, commas, punctuation, or other special characters.
- Length limit: 32 characters (host constraint).

Generated bindings expose `Symbol` parameters as TypeScript `string`. The compiler cannot catch invalid values such as `"Hello, World!"` — the host rejects them at simulation or invoke time.

### Examples

| Value             | Valid as Soroban Symbol? |
| ----------------- | ------------------------ |
| `"hello"`         | Yes                      |
| `"Hello_World"`   | Yes                      |
| `"Hello, World!"` | No (comma and space)     |
| `"transfer"`      | Yes                      |

### What to do in app code

Validate user-facing strings before passing them to contract methods that expect `Symbol`:

```ts
import { assertSorobanSymbol } from "@caatinga/core/browser";

assertSorobanSymbol(userInput, "label");
await client.contract("token").invoke("mint", { label: userInput });
```

Caatinga does not rewrite Stellar CLI binding output. Add validation at your app boundary or normalize inputs (for example replace spaces with underscores) when that fits your contract design.

## Other common mappings

| Soroban type               | TypeScript binding (typical)                       |
| -------------------------- | -------------------------------------------------- |
| `u32`, `i32`, `u64`, `i64` | `number` or `bigint` (depends on binding version)  |
| `Address`                  | `string`                                           |
| `Bytes` / `BytesN`         | `Buffer` or `Uint8Array`                           |
| `Vec<T>`                   | `Array<T>`                                         |
| `Map<K,V>`                 | `Map` or plain object (depends on binding version) |

When in doubt, inspect the generated method signature under `frontend.bindingsOutput` after `ctg generate`.
