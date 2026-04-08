# BLAKE3 Cross-Runtime Benchmark Report

**Date:** 2026-04-08

- **Bun**: 2026-04-08T14:48:59.989Z
- **Deno**: 2026-04-08T14:44:35.494Z
- **Node.js**: 2026-04-08T14:46:40.245Z
- **Wasmtime**: 2026-04-08T14:49:46.000Z

## One-shot functions

### hash (32 B)

| Runner            |                     Bun |                    Deno |               Node.js |             Wasmtime |
| ----------------- | ----------------------: | ----------------------: | --------------------: | -------------------: |
| blake3_wasm       | 61 MB/s (0.53μs) (0.53) | 12 MB/s (2.57μs) (0.11) | **114 MB/s** (0.28μs) |                  N/A |
| blake3_wasm_small | 85 MB/s (0.38μs) (0.88) | 13 MB/s (2.46μs) (0.13) |  **97 MB/s** (0.33μs) |                  N/A |
| npm:blake3-wasm   | 64 MB/s (0.50μs) (0.87) | 12 MB/s (2.56μs) (0.17) |  **73 MB/s** (0.44μs) |                  N/A |
| blake3_component  |                     N/A |                     N/A |                   N/A | **84 MB/s** (0.38μs) |

### hash (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 175 MB/s (5.84μs) (0.21) | 365 MB/s (2.81μs) (0.43) | **844 MB/s** (1.21μs) |                   N/A |
| blake3_wasm_small | 432 MB/s (2.37μs) (0.60) | 286 MB/s (3.58μs) (0.40) | **719 MB/s** (1.42μs) |                   N/A |
| npm:blake3-wasm   | 415 MB/s (2.47μs) (0.67) | 318 MB/s (3.22μs) (0.52) | **617 MB/s** (1.66μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **523 MB/s** (1.96μs) |

### hash (64 KB)

| Runner            |                               Bun |                             Deno |                  Node.js |                 Wasmtime |
| ----------------- | --------------------------------: | -------------------------------: | -----------------------: | -----------------------: |
| blake3_wasm       |        318 MB/s (205.93μs) (0.14) |         **2,171 MB/s** (30.18μs) | **2,227 MB/s** (29.42μs) |                      N/A |
| blake3_wasm_small | 509 MB/s (128.86μs ±0.1μs) (0.58) | 780 MB/s (83.98μs ±0.1μs) (0.90) |   **870 MB/s** (75.30μs) |                      N/A |
| npm:blake3-wasm   |        517 MB/s (126.82μs) (0.61) |           **816 MB/s** (80.33μs) |   **847 MB/s** (77.39μs) |                      N/A |
| blake3_component  |                               N/A |                              N/A |                      N/A | **1,177 MB/s** (55.66μs) |

### hash (1 MB)

| Runner            |                                Bun |                            Deno |                          Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 365 MB/s (2871.21μs ±1.3μs) (0.16) |       **2,232 MB/s** (469.69μs) | **2,235 MB/s** (469.17μs ±0.1μs) |                              N/A |
| blake3_wasm_small | 528 MB/s (1986.25μs ±0.3μs) (0.61) | **852 MB/s** (1230.21μs ±0.3μs) |  **863 MB/s** (1214.42μs ±0.1μs) |                              N/A |
| npm:blake3-wasm   | 514 MB/s (2039.40μs ±0.1μs) (0.61) | **830 MB/s** (1263.44μs ±0.1μs) |  **844 MB/s** (1242.15μs ±0.1μs) |                              N/A |
| blake3_component  |                                N/A |                             N/A |                              N/A | **1,184 MB/s** (885.44μs ±0.1μs) |

## Component model

| Group              |                              Bun |                      Deno |                          Node.js |                         Wasmtime |
| ------------------ | -------------------------------: | ------------------------: | -------------------------------: | -------------------------------: |
| keyed_hash (32 B)  |             **51 MB/s** (0.63μs) |      **15 MB/s** (2.10μs) |             **94 MB/s** (0.34μs) |             **70 MB/s** (0.46μs) |
| keyed_hash (1 KB)  |            **199 MB/s** (5.15μs) |     **320 MB/s** (3.20μs) |            **791 MB/s** (1.29μs) |            **499 MB/s** (2.05μs) |
| keyed_hash (64 KB) |          **365 MB/s** (179.44μs) |  **2,139 MB/s** (30.64μs) |         **2,296 MB/s** (28.55μs) |         **1,176 MB/s** (55.73μs) |
| keyed_hash (1 MB)  |  **364 MB/s** (2878.28μs ±0.7μs) | **2,240 MB/s** (468.08μs) | **2,226 MB/s** (471.01μs ±0.2μs) | **1,092 MB/s** (959.98μs ±2.4μs) |
| derive_key (32 B)  |             **36 MB/s** (0.90μs) |      **14 MB/s** (2.35μs) |             **75 MB/s** (0.42μs) |             **58 MB/s** (0.55μs) |
| derive_key (1 KB)  |            **188 MB/s** (5.44μs) |     **319 MB/s** (3.21μs) |            **744 MB/s** (1.38μs) |            **541 MB/s** (1.89μs) |
| derive_key (64 KB) |          **365 MB/s** (179.76μs) |  **2,128 MB/s** (30.79μs) |         **2,282 MB/s** (28.72μs) |         **1,058 MB/s** (61.97μs) |
| derive_key (1 MB)  | **348 MB/s** (3010.62μs ±13.3μs) | **2,236 MB/s** (468.92μs) | **2,235 MB/s** (469.09μs ±0.1μs) | **1,184 MB/s** (885.34μs ±0.1μs) |

## Streaming (manual hasher loop)

### streaming (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 177 MB/s (5.79μs) (0.33) | 266 MB/s (3.85μs) (0.50) | **536 MB/s** (1.91μs) |                   N/A |
| blake3_wasm_small | 335 MB/s (3.06μs) (0.91) | 231 MB/s (4.43μs) (0.63) | **369 MB/s** (2.78μs) |                   N/A |
| npm:blake3-wasm   | 188 MB/s (5.46μs) (0.86) | 137 MB/s (7.47μs) (0.63) | **218 MB/s** (4.69μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **180 MB/s** (5.69μs) |

### streaming (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |                 Wasmtime |
| ----------------- | -------------------------: | --------------------------: | -----------------------: | -----------------------: |
| blake3_wasm       | 357 MB/s (183.38μs) (0.16) | 2,061 MB/s (31.80μs) (0.95) | **2,179 MB/s** (30.07μs) |                      N/A |
| blake3_wasm_small | 527 MB/s (124.41μs) (0.61) |      **829 MB/s** (79.01μs) |   **863 MB/s** (75.95μs) |                      N/A |
| npm:blake3-wasm   | 510 MB/s (128.54μs) (0.61) |      **796 MB/s** (82.30μs) |   **834 MB/s** (78.62μs) |                      N/A |
| blake3_component  |                        N/A |                         N/A |                      N/A | **1,100 MB/s** (59.55μs) |

### streaming (1 MB)

| Runner            |                                Bun |                               Deno |                         Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ---------------------------------: | ------------------------------: | -------------------------------: |
| blake3_wasm       | 358 MB/s (2930.28μs ±0.8μs) (0.16) |          **2,198 MB/s** (476.99μs) |       **2,201 MB/s** (476.40μs) |                              N/A |
| blake3_wasm_small | 527 MB/s (1989.48μs ±0.2μs) (0.61) |    **852 MB/s** (1230.04μs ±0.2μs) | **867 MB/s** (1209.64μs ±0.1μs) |                              N/A |
| npm:blake3-wasm   | 515 MB/s (2037.33μs ±0.1μs) (0.61) | 773 MB/s (1355.80μs ±3.7μs) (0.91) | **846 MB/s** (1239.79μs ±0.1μs) |                              N/A |
| blake3_component  |                                N/A |                                N/A |                             N/A | **1,110 MB/s** (944.27μs ±0.1μs) |

## Stream convenience functions (ReadableStream)

### hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 71 MB/s (14.48μs) (0.50) | 69 MB/s (14.74μs) (0.49) | **141 MB/s** (7.24μs) |
| blake3_wasm_small | 82 MB/s (12.50μs) (0.59) | 69 MB/s (14.88μs) (0.49) | **140 MB/s** (7.33μs) |

### keyed_hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 69 MB/s (14.84μs) (0.50) | 64 MB/s (15.96μs) (0.46) | **138 MB/s** (7.41μs) |
| blake3_wasm_small | 85 MB/s (12.11μs) (0.66) | 71 MB/s (14.49μs) (0.55) | **128 MB/s** (7.97μs) |

### derive_key_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 70 MB/s (14.72μs) (0.54) | 72 MB/s (14.28μs) (0.56) | **128 MB/s** (7.99μs) |
| blake3_wasm_small | 81 MB/s (12.65μs) (0.63) | 70 MB/s (14.62μs) (0.55) | **128 MB/s** (8.03μs) |

### hash_stream (64 KB)

| Runner            |                               Bun |                        Deno |                  Node.js |
| ----------------- | --------------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 314 MB/s (208.68μs ±0.2μs) (0.17) | 1,418 MB/s (46.23μs) (0.78) | **1,821 MB/s** (36.00μs) |
| blake3_wasm_small |        486 MB/s (134.86μs) (0.61) |   691 MB/s (94.90μs) (0.87) |   **796 MB/s** (82.38μs) |

### keyed_hash_stream (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |
| ----------------- | -------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 339 MB/s (193.44μs) (0.19) | 1,375 MB/s (47.66μs) (0.76) | **1,803 MB/s** (36.36μs) |
| blake3_wasm_small | 485 MB/s (135.25μs) (0.70) |      **694 MB/s** (94.44μs) |   **697 MB/s** (94.07μs) |

### derive_key_stream (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |
| ----------------- | -------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 340 MB/s (192.66μs) (0.19) | 1,323 MB/s (49.52μs) (0.73) | **1,802 MB/s** (36.37μs) |
| blake3_wasm_small | 486 MB/s (134.83μs) (0.61) |  606 MB/s (108.19μs) (0.76) |   **795 MB/s** (82.40μs) |

### hash_stream (1 MB)

| Runner            |                                Bun |                                Deno |                          Node.js |
| ----------------- | ---------------------------------: | ----------------------------------: | -------------------------------: |
| blake3_wasm       | 356 MB/s (2947.17μs ±0.7μs) (0.18) | 1,775 MB/s (590.70μs ±0.4μs) (0.88) | **2,022 MB/s** (518.46μs ±0.1μs) |
| blake3_wasm_small | 516 MB/s (2030.72μs ±0.2μs) (0.62) |     **823 MB/s** (1273.50μs ±0.1μs) |  **833 MB/s** (1258.27μs ±0.1μs) |

### keyed_hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 356 MB/s (2948.11μs ±0.9μs) (0.18) | **2,020 MB/s** (519.16μs ±0.1μs) | **2,025 MB/s** (517.85μs ±0.1μs) |
| blake3_wasm_small | 516 MB/s (2030.74μs ±0.2μs) (0.63) |  **822 MB/s** (1275.13μs ±0.1μs) |  **797 MB/s** (1315.25μs ±3.7μs) |

### derive_key_stream (1 MB)

| Runner            |                                Bun |                             Deno |                             Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | ----------------------------------: |
| blake3_wasm       | 356 MB/s (2944.44μs ±0.8μs) (0.18) | **2,024 MB/s** (517.98μs ±0.1μs) | 1,857 MB/s (564.70μs ±1.1μs) (0.92) |
| blake3_wasm_small | 516 MB/s (2030.62μs ±0.2μs) (0.62) |  **823 MB/s** (1274.31μs ±0.1μs) |     **833 MB/s** (1258.09μs ±0.1μs) |

## Runtime Comparison

```text
RUNTIME COMPARISON (blake3_wasm):

  hash (32 B):
    Bun       █████████████████████░░░░░░░░░░░░░░░░░░░   61 MB/s  0.53μs  0.53
    Deno      ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   12 MB/s  2.57μs  0.11
    Node.js   ████████████████████████████████████████  114 MB/s  0.28μs  1.0

  hash (1 KB):
    Bun       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  175 MB/s  5.84μs  0.21
    Deno      █████████████████░░░░░░░░░░░░░░░░░░░░░░░  365 MB/s  2.81μs  0.43
    Node.js   ████████████████████████████████████████  844 MB/s  1.21μs  1.0

  hash (64 KB):
    Bun       ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    318 MB/s  205.93μs  0.14
    Deno      ███████████████████████████████████████░  2,171 MB/s   30.18μs  1.0
    Node.js   ████████████████████████████████████████  2,227 MB/s   29.42μs  1.0

  hash (1 MB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    365 MB/s  2871.21μs  0.16
    Deno      ████████████████████████████████████████  2,232 MB/s   469.69μs  1.0
    Node.js   ████████████████████████████████████████  2,235 MB/s   469.17μs  1.0

  streaming (1 KB):
    Bun       █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  177 MB/s  5.79μs  0.33
    Deno      ████████████████████░░░░░░░░░░░░░░░░░░░░  266 MB/s  3.85μs  0.50
    Node.js   ████████████████████████████████████████  536 MB/s  1.91μs  1.0

  streaming (64 KB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    357 MB/s  183.38μs  0.16
    Deno      ██████████████████████████████████████░░  2,061 MB/s   31.80μs  0.95
    Node.js   ████████████████████████████████████████  2,179 MB/s   30.07μs  1.0

  streaming (1 MB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    358 MB/s  2930.28μs  0.16
    Deno      ████████████████████████████████████████  2,198 MB/s   476.99μs  1.0
    Node.js   ████████████████████████████████████████  2,201 MB/s   476.40μs  1.0

  hash_stream (1 KB):
    Bun       ████████████████████░░░░░░░░░░░░░░░░░░░░   71 MB/s  14.48μs  0.50
    Deno      ████████████████████░░░░░░░░░░░░░░░░░░░░   69 MB/s  14.74μs  0.49
    Node.js   ████████████████████████████████████████  141 MB/s   7.24μs  1.0

  hash_stream (64 KB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    314 MB/s  208.68μs  0.17
    Deno      ███████████████████████████████░░░░░░░░░  1,418 MB/s   46.23μs  0.78
    Node.js   ████████████████████████████████████████  1,821 MB/s   36.00μs  1.0

  hash_stream (1 MB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    356 MB/s  2947.17μs  0.18
    Deno      ███████████████████████████████████░░░░░  1,775 MB/s   590.70μs  0.88
    Node.js   ████████████████████████████████████████  2,022 MB/s   518.46μs  1.0
```

## vs npm:blake3-wasm (blake3_wasm speedup)

| Group              |      Bun |     Deno |  Node.js |
| ------------------ | -------: | -------: | -------: |
| hash (32 B)        |     0.95 |     1.00 | **1.55** |
| hash (1 KB)        |   _0.42_ | **1.15** | **1.37** |
| hash (64 KB)       |   _0.62_ | **2.66** | **2.63** |
| hash (1 MB)        |   _0.71_ | **2.69** | **2.65** |
| keyed_hash (32 B)  | **3.08** | **2.13** | **6.81** |
| keyed_hash (1 KB)  |   _0.85_ | **1.74** | **2.69** |
| keyed_hash (64 KB) |   _0.72_ | **2.70** | **3.03** |
| keyed_hash (1 MB)  |   _0.71_ | **2.70** | **2.64** |
| derive_key (32 B)  | **2.97** | **1.98** | **6.23** |
| derive_key (1 KB)  |   _0.76_ | **1.76** | **2.74** |
| derive_key (64 KB) |   _0.82_ | **2.69** | **2.77** |
| derive_key (1 MB)  |   _0.68_ | **2.70** | **2.66** |
| streaming (1 KB)   |   _0.94_ | **1.94** | **2.46** |
| streaming (64 KB)  |   _0.70_ | **2.59** | **2.61** |
| streaming (1 MB)   |   _0.70_ | **2.84** | **2.60** |

> 1.0 = blake3_wasm faster, <1.0 = npm:blake3-wasm faster. Bold = we win, italic
> = npm wins.

## SIMD Speedup (blake3_wasm vs blake3_wasm_small)

### One-shot functions

| Group        |    Bun |     Deno |  Node.js |
| ------------ | -----: | -------: | -------: |
| hash (32 B)  | _0.71_ |     0.95 | **1.18** |
| hash (1 KB)  | _0.41_ | **1.27** | **1.17** |
| hash (64 KB) | _0.63_ | **2.78** | **2.56** |
| hash (1 MB)  | _0.69_ | **2.62** | **2.59** |

### Component model

| Group              |    Bun |     Deno |  Node.js |
| ------------------ | -----: | -------: | -------: |
| keyed_hash (32 B)  | _0.76_ |     1.03 | **1.40** |
| keyed_hash (1 KB)  | _0.42_ | **1.10** | **1.16** |
| keyed_hash (64 KB) | _0.69_ | **2.54** | **2.64** |
| keyed_hash (1 MB)  | _0.69_ | **2.63** | **2.58** |
| derive_key (32 B)  | _0.66_ |     1.01 | **1.18** |
| derive_key (1 KB)  | _0.42_ | **1.06** | **1.13** |
| derive_key (64 KB) | _0.71_ | **2.54** | **2.63** |
| derive_key (1 MB)  | _0.66_ | **2.63** | **2.59** |

### Streaming (manual hasher loop)

| Group             |    Bun |     Deno |  Node.js |
| ----------------- | -----: | -------: | -------: |
| streaming (1 KB)  | _0.53_ | **1.15** | **1.45** |
| streaming (64 KB) | _0.68_ | **2.48** | **2.53** |
| streaming (1 MB)  | _0.68_ | **2.58** | **2.54** |

### Stream convenience functions (ReadableStream)

| Group                     |    Bun |     Deno |  Node.js |
| ------------------------- | -----: | -------: | -------: |
| hash_stream (1 KB)        | _0.86_ |     1.01 |     1.01 |
| keyed_hash_stream (1 KB)  | _0.82_ |   _0.91_ | **1.08** |
| derive_key_stream (1 KB)  | _0.86_ |     1.02 |     1.00 |
| hash_stream (64 KB)       | _0.65_ | **2.05** | **2.29** |
| keyed_hash_stream (64 KB) | _0.70_ | **1.98** | **2.59** |
| derive_key_stream (64 KB) | _0.70_ | **2.18** | **2.27** |
| hash_stream (1 MB)        | _0.69_ | **2.16** | **2.43** |
| keyed_hash_stream (1 MB)  | _0.69_ | **2.46** | **2.54** |
| derive_key_stream (1 MB)  | _0.69_ | **2.46** | **2.23** |

> 1.0 = SIMD faster, <1.0 = SIMD slower (Bun regression). Bold = SIMD wins,
> italic = SIMD loses.

## WASM Binary Sizes

### wasm-bindgen

| Binary            |    Size | vs npm:blake3-wasm |
| ----------------- | ------: | -----------------: |
| blake3_wasm       | 46.1 KB |      +12,828 bytes |
| blake3_wasm_small | 31.5 KB |       -2,150 bytes |
| npm:blake3-wasm   | 33.6 KB |           baseline |

### Component

| Binary           |    Size |
| ---------------- | ------: |
| blake3_component | 80.9 KB |

## Notes

- npm:blake3-wasm keyed_hash/derive_key use the streaming API internally (3 wasm
  calls) vs our one-shot wasm exports (1 call), explaining the large gap at
  small sizes.
- Stream functions (hash_stream, etc.) include ReadableStream + async
  reader.read() overhead per iteration. Compare with "streaming" (sync hasher
  loop) for raw hash speed.
- Deno has ~3x higher per-read() overhead than Node.js, dominating stream
  results at small sizes.
- Deno has ~5-9x higher per-call WASM overhead at small inputs vs Node.js (up to
  ~8x for hash at 32B). The wasm-bindgen glue code is identical — this is a Deno
  runtime characteristic.
- At 1 MB, Deno's streaming throughput matches or slightly exceeds Node.js. The
  large Deno overhead at small inputs shrinks to <5% at 1 MB.
- Bun has a WASM SIMD regression — blake3_wasm (SIMD) is slower than
  blake3_wasm_small (no SIMD). This is a Bun runtime issue, not a code issue.
- On Bun, blake3_wasm (SIMD) is slower than npm:blake3-wasm at most sizes due to
  the WASM SIMD regression. Prefer blake3_wasm_small on Bun — it achieves parity
  with npm at large inputs.
