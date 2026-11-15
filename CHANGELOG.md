# @fuzdev/blake3

## 0.2.1

### Patch Changes

- 4d6da87: feat: add a `gro` export condition, `gro.js`, the package's API over Gro's runtime's native BLAKE3 (`@fuzdev/gro/blake3.ts`), so the package runs on `fgro` with no WASM

## 0.2.0

### Minor Changes

- 9b5eefe: **breaking** chore: the npm packages are renamed to kebab-case — `@fuzdev/blake3_wasm` → `@fuzdev/blake3-wasm`, `@fuzdev/blake3_wasm_small` → `@fuzdev/blake3-wasm-small`; crate names are unchanged

## 0.1.1

### Patch Changes

- 575a329: chore: tighten clippy lints to match fuz ecosystem conventions
- e01e3fe: optimize SIMD build size: switch from -O3 to -Os for RUSTFLAGS and wasm-opt (SIMD hot path unaffected — uses `#[inline(always)]`)
- e01e3fe: upgrade blake3 crate to v1.8.4 from v1.8.3

## 0.1.0

### Minor Changes

- 2c5e7ac: initial release - BLAKE3 WASM with SIMD and size-optimized builds
