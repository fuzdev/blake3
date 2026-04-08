# BLAKE3 Cross-Runtime Benchmark Report

**Date:** 2026-04-08

- **Bun**: 2026-04-08T13:59:12.907Z
- **Deno**: 2026-04-08T13:54:48.230Z
- **Node.js**: 2026-04-08T13:56:53.032Z
- **Wasmtime**: 2026-04-08T14:01:55.000Z

## One-shot functions

### hash (32 B)

| Runner            |                     Bun |                    Deno |               Node.js |             Wasmtime |
| ----------------- | ----------------------: | ----------------------: | --------------------: | -------------------: |
| blake3_wasm       | 48 MB/s (0.67μs) (0.42) | 13 MB/s (2.55μs) (0.11) | **114 MB/s** (0.28μs) |                  N/A |
| blake3_wasm_small | 76 MB/s (0.42μs) (0.78) | 13 MB/s (2.44μs) (0.13) |  **98 MB/s** (0.33μs) |                  N/A |
| npm:blake3-wasm   | 67 MB/s (0.48μs) (0.90) | 13 MB/s (2.54μs) (0.17) |  **74 MB/s** (0.43μs) |                  N/A |
| blake3_component  |                     N/A |                     N/A |                   N/A | **86 MB/s** (0.37μs) |

### hash (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 175 MB/s (5.85μs) (0.21) | 375 MB/s (2.73μs) (0.45) | **833 MB/s** (1.23μs) |                   N/A |
| blake3_wasm_small | 435 MB/s (2.36μs) (0.61) | 302 MB/s (3.39μs) (0.42) | **715 MB/s** (1.43μs) |                   N/A |
| npm:blake3-wasm   | 412 MB/s (2.48μs) (0.67) | 267 MB/s (3.83μs) (0.43) | **617 MB/s** (1.66μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **590 MB/s** (1.73μs) |

### hash (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |                 Wasmtime |
| ----------------- | -------------------------: | --------------------------: | -----------------------: | -----------------------: |
| blake3_wasm       | 366 MB/s (179.22μs) (0.16) | 2,135 MB/s (30.69μs) (0.93) | **2,287 MB/s** (28.65μs) |                      N/A |
| blake3_wasm_small | 530 MB/s (123.57μs) (0.61) |      **826 MB/s** (79.30μs) |   **870 MB/s** (75.35μs) |                      N/A |
| npm:blake3-wasm   | 518 MB/s (126.46μs) (0.61) |   802 MB/s (81.67μs) (0.95) |   **848 MB/s** (77.32μs) |                      N/A |
| blake3_component  |                        N/A |                         N/A |                      N/A | **1,177 MB/s** (55.67μs) |

### hash (1 MB)

| Runner            |                                Bun |                                Deno |                          Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ----------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 364 MB/s (2876.77μs ±0.7μs) (0.16) | 2,055 MB/s (510.29μs ±1.1μs) (0.92) | **2,239 MB/s** (468.29μs ±0.1μs) |                              N/A |
| blake3_wasm_small | 528 MB/s (1987.39μs ±0.3μs) (0.61) |     **841 MB/s** (1247.08μs ±0.5μs) |  **863 MB/s** (1215.09μs ±0.2μs) |                              N/A |
| npm:blake3-wasm   | 513 MB/s (2043.04μs ±0.4μs) (0.61) |  726 MB/s (1444.76μs ±0.2μs) (0.86) |  **843 MB/s** (1243.43μs ±0.2μs) |                              N/A |
| blake3_component  |                                N/A |                                 N/A |                              N/A | **1,070 MB/s** (979.95μs ±2.2μs) |

## Component model

| Group              |                             Bun |                             Deno |                          Node.js |                          Wasmtime |
| ------------------ | ------------------------------: | -------------------------------: | -------------------------------: | --------------------------------: |
| keyed_hash (32 B)  |            **51 MB/s** (0.63μs) |             **13 MB/s** (2.44μs) |             **92 MB/s** (0.35μs) |              **73 MB/s** (0.44μs) |
| keyed_hash (1 KB)  |           **198 MB/s** (5.17μs) |            **291 MB/s** (3.52μs) |            **787 MB/s** (1.30μs) |             **567 MB/s** (1.81μs) |
| keyed_hash (64 KB) |         **364 MB/s** (179.80μs) |         **1,872 MB/s** (35.00μs) |         **2,289 MB/s** (28.63μs) |          **1,176 MB/s** (55.74μs) |
| keyed_hash (1 MB)  | **364 MB/s** (2884.50μs ±0.5μs) |        **2,218 MB/s** (472.67μs) | **2,240 MB/s** (468.05μs ±0.1μs) | **1,034 MB/s** (1014.33μs ±0.2μs) |
| derive_key (32 B)  |            **31 MB/s** (1.02μs) |             **14 MB/s** (2.34μs) |             **75 MB/s** (0.43μs) |              **64 MB/s** (0.50μs) |
| derive_key (1 KB)  |           **188 MB/s** (5.44μs) |            **313 MB/s** (3.27μs) |            **747 MB/s** (1.37μs) |             **497 MB/s** (2.06μs) |
| derive_key (64 KB) |         **364 MB/s** (179.90μs) |         **2,132 MB/s** (30.74μs) |         **1,994 MB/s** (32.87μs) |          **1,081 MB/s** (60.61μs) |
| derive_key (1 MB)  | **364 MB/s** (2883.83μs ±0.6μs) | **2,183 MB/s** (480.24μs ±0.1μs) | **2,232 MB/s** (469.70μs ±0.1μs) |  **1,181 MB/s** (887.87μs ±0.1μs) |

## Streaming (manual hasher loop)

### streaming (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 179 MB/s (5.73μs) (0.33) | 268 MB/s (3.82μs) (0.49) | **545 MB/s** (1.88μs) |                   N/A |
| blake3_wasm_small | 329 MB/s (3.12μs) (0.86) | 229 MB/s (4.47μs) (0.60) | **382 MB/s** (2.68μs) |                   N/A |
| npm:blake3-wasm   | 189 MB/s (5.40μs) (0.77) | 154 MB/s (6.67μs) (0.62) | **247 MB/s** (4.14μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **176 MB/s** (5.83μs) |

### streaming (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |                 Wasmtime |
| ----------------- | -------------------------: | --------------------------: | -----------------------: | -----------------------: |
| blake3_wasm       | 356 MB/s (183.94μs) (0.16) | 2,042 MB/s (32.09μs) (0.94) | **2,180 MB/s** (30.07μs) |                      N/A |
| blake3_wasm_small | 529 MB/s (123.90μs) (0.61) |      **827 MB/s** (79.20μs) |   **862 MB/s** (76.04μs) |                      N/A |
| npm:blake3-wasm   | 508 MB/s (129.07μs) (0.62) |      **794 MB/s** (82.59μs) |   **814 MB/s** (80.47μs) |                      N/A |
| blake3_component  |                        N/A |                         N/A |                      N/A | **1,007 MB/s** (65.09μs) |

### streaming (1 MB)

| Runner            |                                Bun |                            Deno |                          Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 355 MB/s (2949.82μs ±0.5μs) (0.16) |       **2,186 MB/s** (479.72μs) | **2,200 MB/s** (476.66μs ±0.1μs) |                              N/A |
| blake3_wasm_small | 528 MB/s (1987.53μs ±0.5μs) (0.62) | **850 MB/s** (1233.88μs ±0.2μs) |  **835 MB/s** (1255.08μs ±3.2μs) |                              N/A |
| npm:blake3-wasm   | 515 MB/s (2036.96μs ±0.6μs) (0.62) | **828 MB/s** (1266.55μs ±0.3μs) |  **825 MB/s** (1271.50μs ±0.2μs) |                              N/A |
| blake3_component  |                                N/A |                             N/A |                              N/A | **1,106 MB/s** (948.39μs ±0.1μs) |

## Stream convenience functions (ReadableStream)

### hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 71 MB/s (14.35μs) (0.51) | 70 MB/s (14.55μs) (0.51) | **139 MB/s** (7.36μs) |
| blake3_wasm_small | 86 MB/s (11.89μs) (0.62) | 69 MB/s (14.94μs) (0.49) | **138 MB/s** (7.39μs) |

### keyed_hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 71 MB/s (14.51μs) (0.51) | 70 MB/s (14.73μs) (0.50) | **139 MB/s** (7.39μs) |
| blake3_wasm_small | 84 MB/s (12.20μs) (0.67) | 69 MB/s (14.94μs) (0.55) | **126 MB/s** (8.15μs) |

### derive_key_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 69 MB/s (14.74μs) (0.54) | 71 MB/s (14.49μs) (0.55) | **128 MB/s** (7.99μs) |
| blake3_wasm_small | 83 MB/s (12.39μs) (0.67) | 68 MB/s (14.95μs) (0.55) | **123 MB/s** (8.30μs) |

### hash_stream (64 KB)

| Runner            |                        Bun |                              Deno |                  Node.js |
| ----------------- | -------------------------: | --------------------------------: | -----------------------: |
| blake3_wasm       | 340 MB/s (193.00μs) (0.20) |       1,254 MB/s (52.27μs) (0.75) | **1,670 MB/s** (39.25μs) |
| blake3_wasm_small | 485 MB/s (135.21μs) (0.61) | 650 MB/s (100.88μs ±0.1μs) (0.82) |   **794 MB/s** (82.53μs) |

### keyed_hash_stream (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |
| ----------------- | -------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 338 MB/s (193.80μs) (0.19) | 1,425 MB/s (46.00μs) (0.79) | **1,804 MB/s** (36.32μs) |
| blake3_wasm_small | 485 MB/s (135.15μs) (0.61) |   716 MB/s (91.48μs) (0.91) |   **791 MB/s** (82.81μs) |

### derive_key_stream (64 KB)

| Runner            |                               Bun |                        Deno |                  Node.js |
| ----------------- | --------------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 338 MB/s (193.74μs ±0.1μs) (0.19) | 1,247 MB/s (52.55μs) (0.69) | **1,803 MB/s** (36.35μs) |
| blake3_wasm_small | 477 MB/s (137.48μs ±0.1μs) (0.60) |   697 MB/s (94.00μs) (0.88) |   **793 MB/s** (82.60μs) |

### hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 355 MB/s (2953.06μs ±0.8μs) (0.18) | **2,022 MB/s** (518.61μs ±0.1μs) | **2,021 MB/s** (518.93μs ±0.1μs) |
| blake3_wasm_small | 516 MB/s (2030.94μs ±0.5μs) (0.62) |  **822 MB/s** (1275.34μs ±0.2μs) |  **831 MB/s** (1261.40μs ±0.2μs) |

### keyed_hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 354 MB/s (2957.91μs ±0.7μs) (0.17) | **2,026 MB/s** (517.60μs ±0.1μs) | **2,020 MB/s** (519.09μs ±0.1μs) |
| blake3_wasm_small | 513 MB/s (2042.79μs ±0.5μs) (0.62) |  **822 MB/s** (1275.55μs ±0.2μs) |  **830 MB/s** (1262.81μs ±0.2μs) |

### derive_key_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 353 MB/s (2969.26μs ±1.1μs) (0.17) | **2,021 MB/s** (518.74μs ±0.1μs) | **2,025 MB/s** (517.88μs ±0.1μs) |
| blake3_wasm_small | 517 MB/s (2028.94μs ±0.4μs) (0.62) |  **823 MB/s** (1274.83μs ±0.2μs) |  **830 MB/s** (1263.77μs ±0.2μs) |

## Runtime Comparison

```text
RUNTIME COMPARISON (blake3_wasm):

  hash (32 B):
    Bun       █████████████████░░░░░░░░░░░░░░░░░░░░░░░   48 MB/s  0.67μs  0.42
    Deno      ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   13 MB/s  2.55μs  0.11
    Node.js   ████████████████████████████████████████  114 MB/s  0.28μs  1.0

  hash (1 KB):
    Bun       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  175 MB/s  5.85μs  0.21
    Deno      ██████████████████░░░░░░░░░░░░░░░░░░░░░░  375 MB/s  2.73μs  0.45
    Node.js   ████████████████████████████████████████  833 MB/s  1.23μs  1.0

  hash (64 KB):
    Bun       ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    366 MB/s  179.22μs  0.16
    Deno      █████████████████████████████████████░░░  2,135 MB/s   30.69μs  0.93
    Node.js   ████████████████████████████████████████  2,287 MB/s   28.65μs  1.0

  hash (1 MB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    364 MB/s  2876.77μs  0.16
    Deno      █████████████████████████████████████░░░  2,055 MB/s   510.29μs  0.92
    Node.js   ████████████████████████████████████████  2,239 MB/s   468.29μs  1.0

  streaming (1 KB):
    Bun       █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  179 MB/s  5.73μs  0.33
    Deno      ████████████████████░░░░░░░░░░░░░░░░░░░░  268 MB/s  3.82μs  0.49
    Node.js   ████████████████████████████████████████  545 MB/s  1.88μs  1.0

  streaming (64 KB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    356 MB/s  183.94μs  0.16
    Deno      █████████████████████████████████████░░░  2,042 MB/s   32.09μs  0.94
    Node.js   ████████████████████████████████████████  2,180 MB/s   30.07μs  1.0

  streaming (1 MB):
    Bun       ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    355 MB/s  2949.82μs  0.16
    Deno      ████████████████████████████████████████  2,186 MB/s   479.72μs  1.0
    Node.js   ████████████████████████████████████████  2,200 MB/s   476.66μs  1.0

  hash_stream (1 KB):
    Bun       █████████████████████░░░░░░░░░░░░░░░░░░░   71 MB/s  14.35μs  0.51
    Deno      ████████████████████░░░░░░░░░░░░░░░░░░░░   70 MB/s  14.55μs  0.51
    Node.js   ████████████████████████████████████████  139 MB/s   7.36μs  1.0

  hash_stream (64 KB):
    Bun       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    340 MB/s  193.00μs  0.20
    Deno      ██████████████████████████████░░░░░░░░░░  1,254 MB/s   52.27μs  0.75
    Node.js   ████████████████████████████████████████  1,670 MB/s   39.25μs  1.0

  hash_stream (1 MB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    355 MB/s  2953.06μs  0.18
    Deno      ████████████████████████████████████████  2,022 MB/s   518.61μs  1.0
    Node.js   ████████████████████████████████████████  2,021 MB/s   518.93μs  1.0
```

## vs npm:blake3-wasm (blake3_wasm speedup)

| Group              |      Bun |     Deno |  Node.js |
| ------------------ | -------: | -------: | -------: |
| hash (32 B)        |   _0.72_ |     1.00 | **1.53** |
| hash (1 KB)        |   _0.43_ | **1.40** | **1.35** |
| hash (64 KB)       |   _0.71_ | **2.66** | **2.70** |
| hash (1 MB)        |   _0.71_ | **2.83** | **2.66** |
| keyed_hash (32 B)  | **3.11** | **1.86** | **5.82** |
| keyed_hash (1 KB)  |   _0.80_ | **1.79** | **2.35** |
| keyed_hash (64 KB) |   _0.81_ | **2.40** | **2.86** |
| keyed_hash (1 MB)  |   _0.81_ | **2.72** | **2.70** |
| derive_key (32 B)  | **2.69** | **2.00** | **5.86** |
| derive_key (1 KB)  |   _0.83_ | **1.77** | **2.79** |
| derive_key (64 KB) |   _0.72_ | **2.73** | **2.49** |
| derive_key (1 MB)  |   _0.71_ | **2.64** | **2.70** |
| streaming (1 KB)   |   _0.94_ | **1.75** | **2.20** |
| streaming (64 KB)  |   _0.70_ | **2.57** | **2.68** |
| streaming (1 MB)   |   _0.69_ | **2.64** | **2.67** |

> 1.0 = blake3_wasm faster, <1.0 = npm:blake3-wasm faster. Bold = we win, italic
> = npm wins.

## SIMD Speedup (blake3_wasm vs blake3_wasm_small)

### One-shot functions

| Group        |    Bun |     Deno |  Node.js |
| ------------ | -----: | -------: | -------: |
| hash (32 B)  | _0.63_ |     0.96 | **1.16** |
| hash (1 KB)  | _0.40_ | **1.24** | **1.16** |
| hash (64 KB) | _0.69_ | **2.58** | **2.63** |
| hash (1 MB)  | _0.69_ | **2.44** | **2.59** |

### Component model

| Group              |    Bun |     Deno |  Node.js |
| ------------------ | -----: | -------: | -------: |
| keyed_hash (32 B)  | _0.78_ |     0.98 | **1.16** |
| keyed_hash (1 KB)  | _0.48_ | **1.10** | **1.13** |
| keyed_hash (64 KB) | _0.69_ | **2.25** | **2.63** |
| keyed_hash (1 MB)  | _0.69_ | **2.98** | **2.59** |
| derive_key (32 B)  | _0.62_ |     1.03 | **1.20** |
| derive_key (1 KB)  | _0.43_ | **1.07** | **1.13** |
| derive_key (64 KB) | _0.69_ | **2.58** | **2.30** |
| derive_key (1 MB)  | _0.69_ | **2.59** | **2.59** |

### Streaming (manual hasher loop)

| Group             |    Bun |     Deno |  Node.js |
| ----------------- | -----: | -------: | -------: |
| streaming (1 KB)  | _0.54_ | **1.17** | **1.43** |
| streaming (64 KB) | _0.67_ | **2.47** | **2.53** |
| streaming (1 MB)  | _0.67_ | **2.57** | **2.63** |

### Stream convenience functions (ReadableStream)

| Group                     |    Bun |     Deno |  Node.js |
| ------------------------- | -----: | -------: | -------: |
| hash_stream (1 KB)        | _0.83_ |     1.03 |     1.00 |
| keyed_hash_stream (1 KB)  | _0.84_ |     1.01 | **1.10** |
| derive_key_stream (1 KB)  | _0.84_ |     1.03 |     1.04 |
| hash_stream (64 KB)       | _0.70_ | **1.93** | **2.10** |
| keyed_hash_stream (64 KB) | _0.70_ | **1.99** | **2.28** |
| derive_key_stream (64 KB) | _0.71_ | **1.79** | **2.27** |
| hash_stream (1 MB)        | _0.69_ | **2.46** | **2.43** |
| keyed_hash_stream (1 MB)  | _0.69_ | **2.46** | **2.43** |
| derive_key_stream (1 MB)  | _0.68_ | **2.46** | **2.44** |

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
