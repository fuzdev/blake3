# Architecture

## Purpose

Own BLAKE3 WASM build from the `blake3` Rust crate, published as `@fuzdev/blake3_wasm` (SIMD, `-Os`, ~45 KB) for maximum throughput on Deno/Node.js and `@fuzdev/blake3_wasm_small` (no SIMD, `-Os`, ~32 KB) for Bun and bundle-size-sensitive contexts. Benchmark tooling compares against `npm:blake3-wasm`.

## Crate Structure

```
blake3 (Rust crate, upstream)
    ↓
blake3_wasm_core (rlib — shared wasm-bindgen API + shared TS)
    ↓ (simd feature)          ↓ (no simd)
blake3_wasm (cdylib)       blake3_wasm_small (cdylib)

blake3 (upstream, directly)
    ↓
blake3_component (WASI component via WIT, wasm32_simd)

blake3_bench_wasmtime (loads blake3_component, Wasmtime host)
blake3_debug (native binary: reference hashing, test vectors)
```

Six Rust crates. `blake3_wasm_core` is an rlib with a `simd` feature that enables `blake3/wasm32_simd`. Both `blake3_wasm` and `blake3_wasm_small` depend on `blake3_wasm_core` and re-export via `pub use blake3_wasm_core::*;`. blake3_wasm enables the `simd` feature; blake3_wasm_small does not. blake3_component depends on `blake3` directly (not via blake3_wasm_core) and uses `-O3` with `wasm32_simd` via RUSTFLAGS.

## API Surface

**One-shot:** `hash`, `keyed_hash` (throws on invalid key), `derive_key`

**Streaming:** `Blake3Hasher` with `new`, `new_keyed` (throws on invalid key), `new_derive_key`, `update`, `finalize`, `finalize_and_reset`, `reset`, `free`, `[Symbol.dispose]`

**Async streams:** `hash_stream`, `keyed_hash_stream`, `derive_key_stream` — convenience functions that hash a `ReadableStream<Uint8Array>` via the streaming hasher. Defined in `stream.ts`, re-exported from all entry points.

## Build Pipeline

```
Rust (blake3_wasm_core with simd feature)
    → blake3_wasm (pub use core::*)
    → wasm-pack build --target {deno,web}
    → crates/blake3_wasm/pkg/{deno,web}/
    → mod.ts (Deno entry, pkg/deno/)
    → mod_node.ts (Node entry, pkg/web/ + init_sync)

Rust (blake3_wasm_core without simd)
    → blake3_wasm_small (pub use core::*)
    → wasm-pack build --target {deno,web}
    → crates/blake3_wasm_small/pkg/{deno,web}/
    → mod.ts (Deno entry, pkg/deno/)
    → mod_node.ts (Node entry, pkg/web/ + init_sync)

    → cargo component build -p blake3_component
    → pkg/component/blake3_component.wasm (WASI component)
```

blake3_wasm: `RUSTFLAGS='-C opt-level=s -C target-feature=+simd128'` and wasm-opt `-Os --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int --enable-mutable-globals --enable-sign-ext --strip-producers`.
blake3_component: `RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128'` and wasm-opt `-O3 --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int --enable-mutable-globals --enable-sign-ext --strip-producers`.
blake3_wasm_small: `RUSTFLAGS='-C opt-level=s'` (no SIMD flags) and wasm-opt `-Os --enable-bulk-memory --enable-nontrapping-float-to-int --enable-mutable-globals --enable-sign-ext --strip-producers`.

Note: wasm-pack doesn't support `--profile` (conflicts with `--release`), so RUSTFLAGS is the mechanism for overriding optimization level.

## Package Entry Points

Deno and Node.js entry points import from `pkg/deno/` and `pkg/web/` respectively. Both share `types.ts` (re-exported from `blake3_wasm_core/types.ts`) for the `Blake3HasherInstance` interface. wasm-bindgen's JS glue includes `Symbol.dispose` on `Blake3Hasher` (all targets). `mod_node.ts` uses `node:fs` + wasm-bindgen's `initSync` to load WASM synchronously from the web target — no separate node target needed. Stream convenience functions are built by `make_stream_functions` in `stream.ts` and re-exported from each entry point.

**Naming convention:** wasm-bindgen generates `initSync` (camelCase) in its JS output (`blake3_wasm.js`). This is a wasm-bindgen convention and cannot be changed without post-processing the generated file. The wrapper files (`index.js`, `browser.js`) re-export as `init_sync` for snake_case consistency with the rest of the API (`hash`, `keyed_hash`, etc.). `mod_node.ts` imports `initSync` internally but does not re-export it — consumers of `mod_node.ts` never see the camelCase name.

For npm packages, `patch_npm_package.ts` generates `stream.js` from `stream.ts` via targeted type stripping (single source of truth — no hand-maintained JS copy). The `browser.js` entry guards all public API including `Blake3Hasher` constructor and static methods with an init check. An npm-specific README is generated with user-facing content only.

```
crates/blake3_wasm_core/
├── types.ts          # Source of truth (Blake3HasherInstance, Blake3HasherConstructor)
└── stream.ts         # Source of truth (make_stream_functions)

crates/blake3_wasm/
├── types.ts          # Re-export from blake3_wasm_core
├── stream.ts         # Re-export from blake3_wasm_core
├── mod.ts            # @fuzdev/blake3_wasm → pkg/deno/
└── mod_node.ts       # @fuzdev/blake3_wasm → pkg/web/ (node:fs + init_sync)

crates/blake3_wasm_small/
├── types.ts          # Re-export from blake3_wasm_core
├── stream.ts         # Re-export from blake3_wasm_core
├── mod.ts            # @fuzdev/blake3_wasm_small → pkg/deno/
└── mod_node.ts       # @fuzdev/blake3_wasm_small → pkg/web/ (node:fs + init_sync)
```

## Test Vectors

Shared `test/test_vectors.json`, generated once by `blake3_debug`:

```
cargo run -p blake3_debug -- test-vectors > test/test_vectors.json
```

Loaded by `scripts/compare.ts` (wasm-bindgen correctness) and `blake3_bench_wasmtime --compare` (component model correctness).

## Benchmark Architecture

See `benches/CLAUDE.md` for benchmark docs, environment variables, comparison caveats,
and WASM boundary crossing analysis.

```
benches/
├── report.ts            # Cross-runtime comparison (auto-discovers results)
├── diff.ts              # Regression detection (Welch's t-test, Cohen's d)
├── lib/
│   ├── bench_core.ts    # Shared engine: make_runners, make_hasher, run_benchmarks
│   └── color.ts         # ANSI styling (configures st from @fuzdev/fuz_util/print)
├── deno/
│   └── bench.ts         # Deno entry → benches/results/deno.json
└── node/
    └── bench.ts         # Node/Bun entry → benches/results/{node,bun}.json

crates/blake3_bench_wasmtime/
└── src/main.rs          # Wasmtime entry → benches/results/wasmtime.json
```

### Runners

JS runtimes benchmark 3 implementations across one-shot functions (hash, keyed_hash, derive_key at 4 sizes), streaming (3 sizes), and stream convenience functions (hash_stream, keyed_hash_stream, derive_key_stream at 3 sizes):

1. `blake3_wasm` — our SIMD build (category: `blake3`)
2. `blake3_wasm_small` — our size-optimized build (category: `blake3`)
3. `npm:blake3-wasm` — reference package (category: `reference`)

Wasmtime benchmarks the component via the WASI component model (hash, keyed_hash, derive_key, streaming).

### Pipeline

`deno task bench` chains: `bench:build` → `bench:deno` → `bench:node` → `bench:bun` → `bench:wasmtime:run` → `bench:report` → `validate:bench`

Each entry point writes structured JSON to `benches/results/{runtime}.json` plus timestamped history files (`{timestamp}_{runtime}_{commit}.{json,md}`). The report auto-discovers the latest JSON files and produces a cross-runtime comparison with throughput, SIMD speedup table, and WASM binary sizes.

### Result Validation

`deno task validate:bench` validates all non-timestamped `benches/results/*.json` files against the `BenchSuiteResult` schema. This catches drift between the Rust structs (`blake3_bench_wasmtime`) and the TS interfaces (`benches/lib/bench_core.ts`).

## Tooling

- **`scripts/compare.ts`** — Correctness: `Deno.test` suite verifying wasm-bindgen output against native blake3 test vectors, including stream batch boundary tests and error path tests for invalid key length. Supports `--small` flag to test blake3_wasm_small instead of blake3_wasm. Run via `deno task test:deno` / `test:deno:small`.
- **`scripts/build_wasm.ts`** — Parallel WASM build orchestrator: runs blake3_wasm and blake3_wasm_small builds concurrently (deno→web sequential within each package).
- **`scripts/test_npm.js`** — Node.js tests for npm packages (index.js + browser.js init-guard tests). `PKG_DIR` env var selects the package to test.
- **`scripts/validate_bench_results.ts`** — Schema validation: checks bench result JSON against `BenchSuiteResult` structure to catch Rust/TS drift.
- **`benches/deno/bench.ts`** — Performance: benchmarks in Deno
- **`benches/node/bench.ts`** — Performance: benchmarks in Node.js and Bun (runtime configurable via env vars)
- **`crates/blake3_bench_wasmtime/`** — Performance: benchmarks WASI component via Wasmtime. Uses MAD-based outlier removal matching the JS `Benchmark` class. Also provides `--compare` mode for component model correctness verification.
- **`benches/report.ts`** — Cross-runtime comparison with ratio annotations, visual bars, markdown output
- **`benches/diff.ts`** — Regression detection between two result files using Welch's t-test and Cohen's d
- **`blake3_debug`** — Rust binary for native reference hashing and test vectors
- **Reference:** `npm:blake3-wasm` package in `node_modules/` for comparison
