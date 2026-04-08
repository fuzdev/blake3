---
"@fuzdev/blake3": patch
---

optimize SIMD build size: switch from -O3 to -Os for RUSTFLAGS and wasm-opt (SIMD hot path unaffected — uses `#[inline(always)]`)
