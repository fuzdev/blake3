# BLAKE3 Cross-Runtime Benchmark Report

**Date:** 2026-04-08

- **Bun**: 2026-04-08T14:20:40.074Z
- **Deno**: 2026-04-08T14:16:13.883Z
- **Node.js**: 2026-04-08T14:18:19.050Z
- **Wasmtime**: 2026-04-08T14:21:26.000Z

## One-shot functions

### hash (32 B)

| Runner            |                     Bun |                    Deno |              Node.js |             Wasmtime |
| ----------------- | ----------------------: | ----------------------: | -------------------: | -------------------: |
| blake3_wasm       | 70 MB/s (0.46μs) (0.70) | 12 MB/s (2.57μs) (0.13) | **99 MB/s** (0.32μs) |                  N/A |
| blake3_wasm_small | 83 MB/s (0.38μs) (0.95) | 13 MB/s (2.43μs) (0.15) | **88 MB/s** (0.36μs) |                  N/A |
| npm:blake3-wasm   | 69 MB/s (0.46μs) (0.95) | 12 MB/s (2.57μs) (0.17) | **73 MB/s** (0.44μs) |                  N/A |
| blake3_component  |                     N/A |                     N/A |                  N/A | **92 MB/s** (0.35μs) |

### hash (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 256 MB/s (3.99μs) (0.30) | 371 MB/s (2.76μs) (0.43) | **859 MB/s** (1.19μs) |                   N/A |
| blake3_wasm_small | 467 MB/s (2.19μs) (0.68) | 287 MB/s (3.57μs) (0.42) | **690 MB/s** (1.48μs) |                   N/A |
| npm:blake3-wasm   | 442 MB/s (2.32μs) (0.73) | 336 MB/s (3.04μs) (0.56) | **605 MB/s** (1.69μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **616 MB/s** (1.66μs) |

### hash (64 KB)

| Runner            |                        Bun |                             Deno |                  Node.js |                 Wasmtime |
| ----------------- | -------------------------: | -------------------------------: | -----------------------: | -----------------------: |
| blake3_wasm       | 454 MB/s (144.27μs) (0.21) |      2,019 MB/s (32.46μs) (0.93) | **2,159 MB/s** (30.35μs) |                      N/A |
| blake3_wasm_small | 524 MB/s (125.00μs) (0.69) | 712 MB/s (92.05μs ±0.1μs) (0.93) |   **762 MB/s** (86.06μs) |                      N/A |
| npm:blake3-wasm   | 515 MB/s (127.23μs) (0.61) |        709 MB/s (92.46μs) (0.85) |   **838 MB/s** (78.23μs) |                      N/A |
| blake3_component  |                        N/A |                              N/A |                      N/A | **1,200 MB/s** (54.63μs) |

### hash (1 MB)

| Runner            |                                Bun |                                Deno |                          Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ----------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 452 MB/s (2318.49μs ±0.4μs) (0.21) | 1,809 MB/s (579.78μs ±0.9μs) (0.86) | **2,106 MB/s** (497.96μs ±0.2μs) |                              N/A |
| blake3_wasm_small | 526 MB/s (1993.76μs ±0.6μs) (0.62) |  671 MB/s (1562.22μs ±0.7μs) (0.79) |  **852 MB/s** (1230.41μs ±1.0μs) |                              N/A |
| npm:blake3-wasm   | 514 MB/s (2041.01μs ±0.7μs) (0.61) |     **815 MB/s** (1286.64μs ±0.3μs) |  **836 MB/s** (1254.79μs ±0.3μs) |                              N/A |
| blake3_component  |                                N/A |                                 N/A |                              N/A | **1,199 MB/s** (874.63μs ±0.2μs) |

## Component model

| Group              |                             Bun |                             Deno |                          Node.js |                         Wasmtime |
| ------------------ | ------------------------------: | -------------------------------: | -------------------------------: | -------------------------------: |
| keyed_hash (32 B)  |            **58 MB/s** (0.55μs) |             **15 MB/s** (2.15μs) |             **97 MB/s** (0.33μs) |             **75 MB/s** (0.43μs) |
| keyed_hash (1 KB)  |           **250 MB/s** (4.09μs) |            **287 MB/s** (3.57μs) |            **843 MB/s** (1.21μs) |            **570 MB/s** (1.80μs) |
| keyed_hash (64 KB) |  **441 MB/s** (148.47μs ±0.1μs) |         **2,009 MB/s** (32.61μs) |         **2,166 MB/s** (30.26μs) |         **1,200 MB/s** (54.61μs) |
| keyed_hash (1 MB)  | **452 MB/s** (2320.92μs ±0.6μs) | **1,910 MB/s** (548.94μs ±1.0μs) | **2,095 MB/s** (500.59μs ±0.2μs) | **1,137 MB/s** (922.40μs ±2.1μs) |
| derive_key (32 B)  |            **42 MB/s** (0.76μs) |             **12 MB/s** (2.57μs) |             **76 MB/s** (0.42μs) |             **66 MB/s** (0.49μs) |
| derive_key (1 KB)  |           **209 MB/s** (4.90μs) |            **321 MB/s** (3.19μs) |            **791 MB/s** (1.29μs) |            **496 MB/s** (2.06μs) |
| derive_key (64 KB) |         **396 MB/s** (165.64μs) |         **1,998 MB/s** (32.80μs) |         **2,152 MB/s** (30.45μs) |         **1,111 MB/s** (59.00μs) |
| derive_key (1 MB)  | **451 MB/s** (2324.91μs ±0.3μs) | **2,076 MB/s** (504.97μs ±0.1μs) | **2,101 MB/s** (499.09μs ±0.2μs) | **1,204 MB/s** (870.89μs ±0.1μs) |

## Streaming (manual hasher loop)

### streaming (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 193 MB/s (5.29μs) (0.39) | 273 MB/s (3.75μs) (0.56) | **492 MB/s** (2.08μs) |                   N/A |
| blake3_wasm_small | 286 MB/s (3.58μs) (0.78) | 205 MB/s (4.99μs) (0.56) | **368 MB/s** (2.79μs) |                   N/A |
| npm:blake3-wasm   | 162 MB/s (6.34μs) (0.75) | 135 MB/s (7.57μs) (0.63) | **215 MB/s** (4.76μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **180 MB/s** (5.69μs) |

### streaming (64 KB)

| Runner            |                        Bun |                     Deno |                       Node.js |                 Wasmtime |
| ----------------- | -------------------------: | -----------------------: | ----------------------------: | -----------------------: |
| blake3_wasm       | 445 MB/s (147.42μs) (0.23) | **1,940 MB/s** (33.79μs) |      **1,950 MB/s** (33.61μs) |                      N/A |
| blake3_wasm_small | 520 MB/s (126.04μs) (0.62) |   **811 MB/s** (80.80μs) |        **845 MB/s** (77.58μs) |                      N/A |
| npm:blake3-wasm   | 501 MB/s (130.70μs) (0.64) |   **787 MB/s** (83.30μs) | **748 MB/s** (87.64μs ±0.1μs) |                      N/A |
| blake3_component  |                        N/A |                      N/A |                           N/A | **1,113 MB/s** (58.86μs) |

### streaming (1 MB)

| Runner            |                                Bun |                               Deno |                             Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ---------------------------------: | ----------------------------------: | -------------------------------: |
| blake3_wasm       | 442 MB/s (2372.30μs ±0.6μs) (0.21) |   **2,065 MB/s** (507.89μs ±0.1μs) | 1,926 MB/s (544.36μs ±1.2μs) (0.93) |                              N/A |
| blake3_wasm_small | 519 MB/s (2019.82μs ±0.9μs) (0.61) |    **831 MB/s** (1262.58μs ±0.3μs) |     **847 MB/s** (1237.88μs ±0.4μs) |                              N/A |
| npm:blake3-wasm   | 473 MB/s (2218.77μs ±7.2μs) (0.57) | 791 MB/s (1325.80μs ±3.3μs) (0.95) |     **836 MB/s** (1254.50μs ±0.3μs) |                              N/A |
| blake3_component  |                                N/A |                                N/A |                                 N/A | **1,123 MB/s** (934.04μs ±0.1μs) |

## Stream convenience functions (ReadableStream)

### hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 68 MB/s (15.11μs) (0.50) | 70 MB/s (14.72μs) (0.51) | **137 MB/s** (7.50μs) |
| blake3_wasm_small | 81 MB/s (12.58μs) (0.66) | 61 MB/s (16.83μs) (0.49) | **123 MB/s** (8.33μs) |

### keyed_hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 64 MB/s (15.90μs) (0.50) | 70 MB/s (14.67μs) (0.55) | **128 MB/s** (8.01μs) |
| blake3_wasm_small | 70 MB/s (14.54μs) (0.54) | 68 MB/s (15.16μs) (0.52) | **131 MB/s** (7.83μs) |

### derive_key_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 65 MB/s (15.73μs) (0.48) | 71 MB/s (14.45μs) (0.52) | **135 MB/s** (7.58μs) |
| blake3_wasm_small | 76 MB/s (13.51μs) (0.60) | 67 MB/s (15.25μs) (0.53) | **127 MB/s** (8.04μs) |

### hash_stream (64 KB)

| Runner            |                               Bun |                        Deno |                       Node.js |
| ----------------- | --------------------------------: | --------------------------: | ----------------------------: |
| blake3_wasm       |        415 MB/s (158.02μs) (0.24) | 1,340 MB/s (48.92μs) (0.78) |      **1,725 MB/s** (37.98μs) |
| blake3_wasm_small | 430 MB/s (152.42μs ±0.1μs) (0.59) |   690 MB/s (94.99μs) (0.94) | **734 MB/s** (89.25μs ±0.1μs) |

### keyed_hash_stream (64 KB)

| Runner            |                               Bun |                        Deno |                  Node.js |
| ----------------- | --------------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 384 MB/s (170.87μs ±0.2μs) (0.24) | 1,404 MB/s (46.66μs) (0.88) | **1,589 MB/s** (41.23μs) |
| blake3_wasm_small |        479 MB/s (136.81μs) (0.61) |   685 MB/s (95.73μs) (0.87) |   **786 MB/s** (83.33μs) |

### derive_key_stream (64 KB)

| Runner            |                        Bun |                             Deno |                       Node.js |
| ----------------- | -------------------------: | -------------------------------: | ----------------------------: |
| blake3_wasm       | 415 MB/s (158.02μs) (0.24) |      1,363 MB/s (48.06μs) (0.79) |      **1,724 MB/s** (38.02μs) |
| blake3_wasm_small | 479 MB/s (136.88μs) (0.67) | 660 MB/s (99.28μs ±0.1μs) (0.92) | **718 MB/s** (91.32μs ±0.1μs) |

### hash_stream (1 MB)

| Runner            |                                Bun |                                Deno |                          Node.js |
| ----------------- | ---------------------------------: | ----------------------------------: | -------------------------------: |
| blake3_wasm       | 439 MB/s (2387.52μs ±0.4μs) (0.23) | 1,737 MB/s (603.51μs ±1.4μs) (0.91) | **1,908 MB/s** (549.60μs ±0.2μs) |
| blake3_wasm_small | 474 MB/s (2214.34μs ±8.3μs) (0.57) |  760 MB/s (1380.61μs ±4.0μs) (0.92) |  **828 MB/s** (1266.47μs ±0.3μs) |

### keyed_hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 436 MB/s (2404.00μs ±1.0μs) (0.23) | **1,899 MB/s** (552.12μs ±0.1μs) | **1,913 MB/s** (548.03μs ±0.1μs) |
| blake3_wasm_small | 508 MB/s (2065.25μs ±1.8μs) (0.62) |  **810 MB/s** (1294.83μs ±0.3μs) |  **825 MB/s** (1271.06μs ±0.3μs) |

### derive_key_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 438 MB/s (2391.72μs ±0.4μs) (0.23) | **1,891 MB/s** (554.60μs ±0.1μs) | **1,910 MB/s** (548.91μs ±0.1μs) |
| blake3_wasm_small | 482 MB/s (2173.74μs ±6.9μs) (0.58) |  **811 MB/s** (1292.73μs ±0.3μs) |  **830 MB/s** (1263.06μs ±0.2μs) |

## Runtime Comparison

```text
RUNTIME COMPARISON (blake3_wasm):

  hash (32 B):
    Bun       ████████████████████████████░░░░░░░░░░░░  70 MB/s  0.46μs  0.70
    Deno      █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12 MB/s  2.57μs  0.13
    Node.js   ████████████████████████████████████████  99 MB/s  0.32μs  1.0

  hash (1 KB):
    Bun       ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  256 MB/s  3.99μs  0.30
    Deno      █████████████████░░░░░░░░░░░░░░░░░░░░░░░  371 MB/s  2.76μs  0.43
    Node.js   ████████████████████████████████████████  859 MB/s  1.19μs  1.0

  hash (64 KB):
    Bun       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    454 MB/s  144.27μs  0.21
    Deno      █████████████████████████████████████░░░  2,019 MB/s   32.46μs  0.93
    Node.js   ████████████████████████████████████████  2,159 MB/s   30.35μs  1.0

  hash (1 MB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    452 MB/s  2318.49μs  0.21
    Deno      ██████████████████████████████████░░░░░░  1,809 MB/s   579.78μs  0.86
    Node.js   ████████████████████████████████████████  2,106 MB/s   497.96μs  1.0

  streaming (1 KB):
    Bun       ████████████████░░░░░░░░░░░░░░░░░░░░░░░░  193 MB/s  5.29μs  0.39
    Deno      ██████████████████████░░░░░░░░░░░░░░░░░░  273 MB/s  3.75μs  0.56
    Node.js   ████████████████████████████████████████  492 MB/s  2.08μs  1.0

  streaming (64 KB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    445 MB/s  147.42μs  0.23
    Deno      ████████████████████████████████████████  1,940 MB/s   33.79μs  1.0
    Node.js   ████████████████████████████████████████  1,950 MB/s   33.61μs  1.0

  streaming (1 MB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    442 MB/s  2372.30μs  0.21
    Deno      ████████████████████████████████████████  2,065 MB/s   507.89μs  1.0
    Node.js   █████████████████████████████████████░░░  1,926 MB/s   544.36μs  0.93

  hash_stream (1 KB):
    Bun       ████████████████████░░░░░░░░░░░░░░░░░░░░   68 MB/s  15.11μs  0.50
    Deno      ████████████████████░░░░░░░░░░░░░░░░░░░░   70 MB/s  14.72μs  0.51
    Node.js   ████████████████████████████████████████  137 MB/s   7.50μs  1.0

  hash_stream (64 KB):
    Bun       ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    415 MB/s  158.02μs  0.24
    Deno      ███████████████████████████████░░░░░░░░░  1,340 MB/s   48.92μs  0.78
    Node.js   ████████████████████████████████████████  1,725 MB/s   37.98μs  1.0

  hash_stream (1 MB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    439 MB/s  2387.52μs  0.23
    Deno      ████████████████████████████████████░░░░  1,737 MB/s   603.51μs  0.91
    Node.js   ████████████████████████████████████████  1,908 MB/s   549.60μs  1.0
```

## vs npm:blake3-wasm (blake3_wasm speedup)

| Group              |      Bun |     Deno |  Node.js |
| ------------------ | -------: | -------: | -------: |
| hash (32 B)        |     1.00 |     1.00 | **1.36** |
| hash (1 KB)        |   _0.58_ | **1.10** | **1.42** |
| hash (64 KB)       |   _0.88_ | **2.85** | **2.58** |
| hash (1 MB)        |   _0.88_ | **2.22** | **2.52** |
| keyed_hash (32 B)  | **3.88** | **2.43** | **6.59** |
| keyed_hash (1 KB)  |     1.02 | **1.76** | **2.98** |
| keyed_hash (64 KB) |   _0.94_ | **2.56** | **2.79** |
| keyed_hash (1 MB)  |   _0.88_ | **2.32** | **2.50** |
| derive_key (32 B)  | **4.02** | **1.85** | **6.68** |
| derive_key (1 KB)  |     0.99 | **1.79** | **2.81** |
| derive_key (64 KB) |   _0.79_ | **2.54** | **2.64** |
| derive_key (1 MB)  |   _0.89_ | **2.87** | **2.66** |
| streaming (1 KB)   | **1.20** | **2.02** | **2.29** |
| streaming (64 KB)  |   _0.89_ | **2.47** | **2.61** |
| streaming (1 MB)   |   _0.94_ | **2.61** | **2.30** |

> 1.0 = blake3_wasm faster, <1.0 = npm:blake3-wasm faster. Bold = we win, italic
> = npm wins.

## SIMD Speedup (blake3_wasm vs blake3_wasm_small)

### One-shot functions

| Group        |    Bun |     Deno |  Node.js |
| ------------ | -----: | -------: | -------: |
| hash (32 B)  | _0.83_ |   _0.95_ | **1.13** |
| hash (1 KB)  | _0.55_ | **1.29** | **1.24** |
| hash (64 KB) | _0.87_ | **2.84** | **2.84** |
| hash (1 MB)  | _0.86_ | **2.69** | **2.47** |

### Component model

| Group              |    Bun |     Deno |  Node.js |
| ------------------ | -----: | -------: | -------: |
| keyed_hash (32 B)  | _0.90_ | **1.26** | **1.21** |
| keyed_hash (1 KB)  | _0.55_ | **1.08** | **1.21** |
| keyed_hash (64 KB) | _0.84_ | **2.41** | **2.84** |
| keyed_hash (1 MB)  | _0.86_ | **2.27** | **2.44** |
| derive_key (32 B)  | _0.78_ |     1.01 | **1.23** |
| derive_key (1 KB)  | _0.54_ | **1.08** | **1.23** |
| derive_key (64 KB) | _0.83_ | **2.40** | **2.49** |
| derive_key (1 MB)  | _0.86_ | **2.47** | **2.45** |

### Streaming (manual hasher loop)

| Group             |    Bun |     Deno |  Node.js |
| ----------------- | -----: | -------: | -------: |
| streaming (1 KB)  | _0.68_ | **1.33** | **1.34** |
| streaming (64 KB) | _0.85_ | **2.39** | **2.31** |
| streaming (1 MB)  | _0.85_ | **2.49** | **2.27** |

### Stream convenience functions (ReadableStream)

| Group                     |    Bun |     Deno |  Node.js |
| ------------------------- | -----: | -------: | -------: |
| hash_stream (1 KB)        | _0.83_ | **1.14** | **1.11** |
| keyed_hash_stream (1 KB)  | _0.91_ |     1.03 |     0.98 |
| derive_key_stream (1 KB)  | _0.86_ | **1.06** | **1.06** |
| hash_stream (64 KB)       |   0.96 | **1.94** | **2.35** |
| keyed_hash_stream (64 KB) | _0.80_ | **2.05** | **2.02** |
| derive_key_stream (64 KB) | _0.87_ | **2.07** | **2.40** |
| hash_stream (1 MB)        | _0.93_ | **2.29** | **2.30** |
| keyed_hash_stream (1 MB)  | _0.86_ | **2.35** | **2.32** |
| derive_key_stream (1 MB)  | _0.91_ | **2.33** | **2.30** |

> 1.0 = SIMD faster, <1.0 = SIMD slower (Bun regression). Bold = SIMD wins,
> italic = SIMD loses.

## WASM Binary Sizes

### wasm-bindgen

| Binary            |    Size | vs npm:blake3-wasm |
| ----------------- | ------: | -----------------: |
| blake3_wasm       | 46.7 KB |      +13,388 bytes |
| blake3_wasm_small | 31.5 KB |       -2,150 bytes |
| npm:blake3-wasm   | 33.6 KB |           baseline |

### Component

| Binary           |    Size |
| ---------------- | ------: |
| blake3_component | 81.4 KB |

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
