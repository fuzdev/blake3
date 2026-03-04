# Crates

## blake3_wasm_core

Shared rlib containing the wasm-bindgen exports (one-shot functions + `Blake3Hasher` struct).
Both `blake3_wasm` and `blake3_wasm_small` depend on this crate and re-export via `pub use blake3_wasm_core::*;`.

Has a `simd` feature that enables `blake3/wasm32_simd` for hand-optimized WASM SIMD compression.
Also contains the shared TypeScript source: `types.ts` (Blake3HasherInstance interface) and
`stream.ts` (stream convenience functions).

## blake3_wasm

WASM bindings via `wasm-bindgen`. Compiled with Rust `-O3` optimization, blake3's `wasm32_simd`
feature (via blake3_wasm_core's `simd` feature) for hand-optimized WASM SIMD compression,
and wasm-opt `-O3 --enable-simd [+feature flags] --strip-producers`.

The build uses `RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128'` to override the workspace
release profile (`opt-level=s`). The `wasm32_simd` Cargo feature enables blake3's hand-written
`wasm32_simd.rs` implementation (ported from SSE2), which is ~2x faster than the portable Rust
code at medium/large inputs.

**Source**: `pub use blake3_wasm_core::*;` — delegates to the shared core crate.

## blake3_wasm_small

Size-optimized WASM bindings — identical API to blake3_wasm but without SIMD. Compiled with
`RUSTFLAGS='-C opt-level=s'` (no `+simd128`) and wasm-opt `-Os [+feature flags] --strip-producers`. Produces a ~34 KB binary vs
~49 KB for the SIMD build. Depends on `blake3_wasm_core` without the `simd` feature, so blake3
uses its portable Rust compression code instead of hand-written SIMD.

**Source**: `pub use blake3_wasm_core::*;` — delegates to the shared core crate.

## blake3_component

WASI component implementing the `fuzdev:blake3` WIT interface. Built with `cargo-component`,
not wasm-pack. Uses the same RUSTFLAGS and `wasm32_simd` feature as blake3_wasm.

## blake3_debug

Development binary for native blake3 operations (hashing, test vector generation).

## blake3_bench_wasmtime

Wasmtime benchmarks for the component model. Loads the component build from `pkg/component/`.
