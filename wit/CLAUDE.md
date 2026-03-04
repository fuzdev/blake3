# wit/blake3.wit

WIT (WebAssembly Interface Type) definition for the `fuzdev:blake3` component.

## Kebab-case Is Required

WIT identifiers **must** use kebab-case (`keyed-hash`, `derive-key`).
This is enforced by the WIT parser — snake_case or camelCase will fail to parse.

**Why:** Kebab-case unambiguously separates words and acronyms, enabling language
binding generators to convert to the idiomatic casing of any target language
(`keyed_hash` in Rust, `keyedHash` in JS, etc.).

## Spec Reference

| Spec            | Local                 | Upstream                                                                      |
| --------------- | --------------------- | ----------------------------------------------------------------------------- |
| Component Model | `../component-model/` | [WebAssembly/component-model](https://github.com/WebAssembly/component-model) |

```bash
git clone https://github.com/WebAssembly/component-model ~/dev/component-model
```

Key sections for WIT:

- `../component-model/design/mvp/WIT.md` lines 772-800 (identifier rules, kebab-case)
- `../component-model/design/mvp/Explainer.md` lines 2671-2690 (rationale for kebab-case)

## API Surface

**Package:** `fuzdev:blake3@0.0.1`

**World `blake3`:** exports `hashing`, imports nothing (pure computation).

**Enum `hash-error`:** `invalid-key-length` — returned when key is not exactly 32 bytes.

**Interface `hashing`:**

| Function     | Signature                                                         |
| ------------ | ----------------------------------------------------------------- |
| `hash`       | `(data: list<u8>) -> list<u8>`                                    |
| `keyed-hash` | `(key: list<u8>, data: list<u8>) -> result<list<u8>, hash-error>` |
| `derive-key` | `(context: string, key-material: list<u8>) -> list<u8>`           |

**Resource `hasher`:** streaming interface with `constructor()`, `new-keyed` (returns `result<hasher, hash-error>`),
`new-derive-key`, `update`, `finalize`, `finalize-and-reset`, `reset`.

## How It's Consumed

- **Build:** `cargo component build -p blake3_component --release`
- **Rust bindings:** `wasmtime::component::bindgen!` in `crates/blake3_bench_wasmtime/`
- **Implementation:** `crates/blake3_component/src/lib.rs` via `wit-bindgen`
- **Correctness:** `deno task compare:component` (verifies all operations + error paths via Wasmtime)
