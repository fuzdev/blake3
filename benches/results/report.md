# BLAKE3 Cross-Runtime Benchmark Report

**Date:** 2026-03-03

- **Bun**: 2026-03-03T17:48:11.942Z
- **Deno**: 2026-03-03T17:43:45.238Z
- **Node.js**: 2026-03-03T17:45:50.031Z
- **Wasmtime**: 2026-03-03T17:48:58.000Z

## One-shot functions

### hash (32 B)

| Runner            |                     Bun |                    Deno |              Node.js |             Wasmtime |
| ----------------- | ----------------------: | ----------------------: | -------------------: | -------------------: |
| blake3_wasm       | 53 MB/s (0.60μs) (0.54) | 13 MB/s (2.38μs) (0.14) | **98 MB/s** (0.33μs) |                  N/A |
| blake3_wasm_small | 73 MB/s (0.44μs) (0.86) | 13 MB/s (2.43μs) (0.16) | **84 MB/s** (0.38μs) |                  N/A |
| npm:blake3-wasm   |    **64 MB/s** (0.50μs) | 13 MB/s (2.53μs) (0.19) | **68 MB/s** (0.47μs) |                  N/A |
| blake3_component  |                     N/A |                     N/A |                  N/A | **97 MB/s** (0.33μs) |

### hash (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 175 MB/s (5.85μs) (0.24) | 306 MB/s (3.34μs) (0.42) | **735 MB/s** (1.39μs) |                   N/A |
| blake3_wasm_small | 431 MB/s (2.38μs) (0.65) | 287 MB/s (3.56μs) (0.43) | **667 MB/s** (1.54μs) |                   N/A |
| npm:blake3-wasm   | 412 MB/s (2.48μs) (0.67) | 330 MB/s (3.10μs) (0.54) | **616 MB/s** (1.66μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **563 MB/s** (1.82μs) |

### hash (64 KB)

| Runner            |                        Bun |                     Deno |                  Node.js |                 Wasmtime |
| ----------------- | -------------------------: | -----------------------: | -----------------------: | -----------------------: |
| blake3_wasm       | 368 MB/s (178.27μs) (0.17) | **2,147 MB/s** (30.53μs) | **2,191 MB/s** (29.91μs) |                      N/A |
| blake3_wasm_small | 531 MB/s (123.47μs) (0.61) |   **834 MB/s** (78.58μs) |   **869 MB/s** (75.42μs) |                      N/A |
| npm:blake3-wasm   | 521 MB/s (125.89μs) (0.62) |   **815 MB/s** (80.38μs) |   **846 MB/s** (77.42μs) |                      N/A |
| blake3_component  |                        N/A |                      N/A |                      N/A | **1,240 MB/s** (52.86μs) |

### hash (1 MB)

| Runner            |                                Bun |                               Deno |                         Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ---------------------------------: | ------------------------------: | -------------------------------: |
| blake3_wasm       | 367 MB/s (2856.53μs ±0.5μs) (0.16) |          **2,259 MB/s** (464.12μs) |       **2,281 MB/s** (459.71μs) |                              N/A |
| blake3_wasm_small | 529 MB/s (1980.66μs ±0.2μs) (0.61) |    **854 MB/s** (1227.91μs ±0.2μs) | **868 MB/s** (1208.19μs ±0.1μs) |                              N/A |
| npm:blake3-wasm   | 519 MB/s (2018.89μs ±0.2μs) (0.61) | 730 MB/s (1436.14μs ±0.1μs) (0.86) | **847 MB/s** (1237.46μs ±0.1μs) |                              N/A |
| blake3_component  |                                N/A |                                N/A |                             N/A | **1,380 MB/s** (760.05μs ±0.1μs) |

## Component model

| Group              |                             Bun |                      Deno |                          Node.js |                         Wasmtime |
| ------------------ | ------------------------------: | ------------------------: | -------------------------------: | -------------------------------: |
| keyed_hash (32 B)  |            **50 MB/s** (0.64μs) |      **13 MB/s** (2.41μs) |             **92 MB/s** (0.35μs) |             **84 MB/s** (0.38μs) |
| keyed_hash (1 KB)  |           **171 MB/s** (5.98μs) |     **281 MB/s** (3.65μs) |            **787 MB/s** (1.30μs) |            **619 MB/s** (1.65μs) |
| keyed_hash (64 KB) |         **366 MB/s** (178.94μs) |  **2,041 MB/s** (32.12μs) |         **2,129 MB/s** (30.79μs) |         **1,373 MB/s** (47.73μs) |
| keyed_hash (1 MB)  | **367 MB/s** (2857.41μs ±0.5μs) | **2,264 MB/s** (463.16μs) | **2,275 MB/s** (460.94μs ±0.1μs) | **1,383 MB/s** (758.24μs ±0.1μs) |
| derive_key (32 B)  |            **35 MB/s** (0.91μs) |      **14 MB/s** (2.37μs) |             **75 MB/s** (0.43μs) |             **68 MB/s** (0.47μs) |
| derive_key (1 KB)  |           **189 MB/s** (5.43μs) |     **312 MB/s** (3.29μs) |            **744 MB/s** (1.38μs) |            **581 MB/s** (1.76μs) |
| derive_key (64 KB) |         **367 MB/s** (178.67μs) |  **2,116 MB/s** (30.97μs) |         **2,279 MB/s** (28.76μs) |         **1,370 MB/s** (47.82μs) |
| derive_key (1 MB)  | **367 MB/s** (2855.90μs ±0.6μs) | **2,254 MB/s** (465.30μs) | **2,275 MB/s** (460.85μs ±0.1μs) | **1,379 MB/s** (760.57μs ±0.1μs) |

## Streaming (manual hasher loop)

### streaming (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 177 MB/s (5.80μs) (0.32) | 262 MB/s (3.91μs) (0.47) | **551 MB/s** (1.86μs) |                   N/A |
| blake3_wasm_small | 326 MB/s (3.14μs) (0.82) | 228 MB/s (4.50μs) (0.57) | **398 MB/s** (2.57μs) |                   N/A |
| npm:blake3-wasm   | 190 MB/s (5.39μs) (0.77) | 157 MB/s (6.51μs) (0.64) | **247 MB/s** (4.14μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **179 MB/s** (5.72μs) |

### streaming (64 KB)

| Runner            |                        Bun |                        Deno |                          Node.js |                 Wasmtime |
| ----------------- | -------------------------: | --------------------------: | -------------------------------: | -----------------------: |
| blake3_wasm       | 360 MB/s (182.26μs) (0.17) | 2,034 MB/s (32.21μs) (0.94) |         **2,175 MB/s** (30.14μs) |                      N/A |
| blake3_wasm_small | 529 MB/s (123.93μs) (0.64) |      **828 MB/s** (79.19μs) | 775 MB/s (84.52μs ±0.1μs) (0.94) |                      N/A |
| npm:blake3-wasm   | 514 MB/s (127.52μs) (0.62) |      **798 MB/s** (82.08μs) |           **830 MB/s** (78.98μs) |                      N/A |
| blake3_component  |                        N/A |                         N/A |                              N/A | **1,278 MB/s** (51.29μs) |

### streaming (1 MB)

| Runner            |                                Bun |                             Deno |                             Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | -------------------------------: | ----------------------------------: | -------------------------------: |
| blake3_wasm       | 358 MB/s (2926.52μs ±0.5μs) (0.16) | **2,188 MB/s** (479.35μs ±0.1μs) | 1,923 MB/s (545.26μs ±0.1μs) (0.88) |                              N/A |
| blake3_wasm_small | 528 MB/s (1984.83μs ±0.1μs) (0.61) |  **851 MB/s** (1232.21μs ±0.1μs) |     **865 MB/s** (1211.72μs ±0.1μs) |                              N/A |
| npm:blake3-wasm   | 519 MB/s (2020.28μs ±0.1μs) (0.62) |  **831 MB/s** (1261.52μs ±0.1μs) |     **842 MB/s** (1245.71μs ±0.1μs) |                              N/A |
| blake3_component  |                                N/A |                              N/A |                                 N/A | **1,129 MB/s** (928.43μs ±0.2μs) |

## Stream convenience functions (ReadableStream)

### hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 56 MB/s (18.42μs) (0.39) | 54 MB/s (18.91μs) (0.38) | **141 MB/s** (7.25μs) |
| blake3_wasm_small | 75 MB/s (13.59μs) (0.54) | 48 MB/s (21.25μs) (0.34) | **141 MB/s** (7.28μs) |

### keyed_hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 59 MB/s (17.49μs) (0.42) | 55 MB/s (18.50μs) (0.40) | **138 MB/s** (7.40μs) |
| blake3_wasm_small | 73 MB/s (13.99μs) (0.56) | 55 MB/s (18.69μs) (0.42) | **132 MB/s** (7.78μs) |

### derive_key_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 63 MB/s (16.15μs) (0.48) | 55 MB/s (18.70μs) (0.42) | **131 MB/s** (7.83μs) |
| blake3_wasm_small | 71 MB/s (14.42μs) (0.56) | 53 MB/s (19.23μs) (0.42) | **128 MB/s** (8.03μs) |

### hash_stream (64 KB)

| Runner            |                               Bun |                        Deno |                  Node.js |
| ----------------- | --------------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 314 MB/s (208.88μs ±0.2μs) (0.17) | 1,368 MB/s (47.90μs) (0.76) | **1,809 MB/s** (36.22μs) |
| blake3_wasm_small |        477 MB/s (137.32μs) (0.60) |   689 MB/s (95.09μs) (0.87) |   **795 MB/s** (82.40μs) |

### keyed_hash_stream (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |
| ----------------- | -------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 338 MB/s (194.13μs) (0.19) | 1,344 MB/s (48.75μs) (0.75) | **1,797 MB/s** (36.47μs) |
| blake3_wasm_small | 476 MB/s (137.58μs) (0.60) |   687 MB/s (95.42μs) (0.87) |   **794 MB/s** (82.59μs) |

### derive_key_stream (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |
| ----------------- | -------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 337 MB/s (194.27μs) (0.19) | 1,365 MB/s (48.02μs) (0.76) | **1,791 MB/s** (36.58μs) |
| blake3_wasm_small | 477 MB/s (137.43μs) (0.60) |   687 MB/s (95.45μs) (0.87) |   **792 MB/s** (82.75μs) |

### hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 356 MB/s (2942.18μs ±0.5μs) (0.18) | **2,001 MB/s** (524.08μs ±0.1μs) | **2,012 MB/s** (521.17μs ±0.1μs) |
| blake3_wasm_small | 514 MB/s (2039.76μs ±0.4μs) (0.62) |  **819 MB/s** (1280.14μs ±0.1μs) |  **832 MB/s** (1259.63μs ±0.1μs) |

### keyed_hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 355 MB/s (2954.35μs ±0.6μs) (0.18) | **1,999 MB/s** (524.44μs ±0.1μs) | **2,011 MB/s** (521.53μs ±0.1μs) |
| blake3_wasm_small | 516 MB/s (2031.05μs ±0.2μs) (0.62) |  **818 MB/s** (1281.49μs ±0.1μs) |  **832 MB/s** (1260.70μs ±0.1μs) |

### derive_key_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 356 MB/s (2942.67μs ±0.5μs) (0.18) | **1,998 MB/s** (524.90μs ±0.1μs) | **2,007 MB/s** (522.46μs ±0.1μs) |
| blake3_wasm_small | 516 MB/s (2031.35μs ±0.2μs) (0.62) |  **819 MB/s** (1281.01μs ±0.1μs) |  **832 MB/s** (1260.99μs ±0.1μs) |

## Runtime Comparison

```text
RUNTIME COMPARISON (blake3_wasm):

  hash (32 B):
    Bun       ██████████████████████░░░░░░░░░░░░░░░░░░  53 MB/s  0.60μs  0.54
    Deno      █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  13 MB/s  2.38μs  0.14
    Node.js   ████████████████████████████████████████  98 MB/s  0.33μs  1.0

  hash (1 KB):
    Bun       ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  175 MB/s  5.85μs  0.24
    Deno      █████████████████░░░░░░░░░░░░░░░░░░░░░░░  306 MB/s  3.34μs  0.42
    Node.js   ████████████████████████████████████████  735 MB/s  1.39μs  1.0

  hash (64 KB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    368 MB/s  178.27μs  0.17
    Deno      ███████████████████████████████████████░  2,147 MB/s   30.53μs  1.0
    Node.js   ████████████████████████████████████████  2,191 MB/s   29.91μs  1.0

  hash (1 MB):
    Bun       ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    367 MB/s  2856.53μs  0.16
    Deno      ████████████████████████████████████████  2,259 MB/s   464.12μs  1.0
    Node.js   ████████████████████████████████████████  2,281 MB/s   459.71μs  1.0

  streaming (1 KB):
    Bun       █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  177 MB/s  5.80μs  0.32
    Deno      ███████████████████░░░░░░░░░░░░░░░░░░░░░  262 MB/s  3.91μs  0.47
    Node.js   ████████████████████████████████████████  551 MB/s  1.86μs  1.0

  streaming (64 KB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    360 MB/s  182.26μs  0.17
    Deno      █████████████████████████████████████░░░  2,034 MB/s   32.21μs  0.94
    Node.js   ████████████████████████████████████████  2,175 MB/s   30.14μs  1.0

  streaming (1 MB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    358 MB/s  2926.52μs  0.16
    Deno      ████████████████████████████████████████  2,188 MB/s   479.35μs  1.0
    Node.js   ███████████████████████████████████░░░░░  1,923 MB/s   545.26μs  0.88

  hash_stream (1 KB):
    Bun       ████████████████░░░░░░░░░░░░░░░░░░░░░░░░   56 MB/s  18.42μs  0.39
    Deno      ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░   54 MB/s  18.91μs  0.38
    Node.js   ████████████████████████████████████████  141 MB/s   7.25μs  1.0

  hash_stream (64 KB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    314 MB/s  208.88μs  0.17
    Deno      ██████████████████████████████░░░░░░░░░░  1,368 MB/s   47.90μs  0.76
    Node.js   ████████████████████████████████████████  1,809 MB/s   36.22μs  1.0

  hash_stream (1 MB):
    Bun       ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    356 MB/s  2942.18μs  0.18
    Deno      ████████████████████████████████████████  2,001 MB/s   524.08μs  1.0
    Node.js   ████████████████████████████████████████  2,012 MB/s   521.17μs  1.0
```

## vs npm:blake3-wasm (blake3_wasm speedup)

| Group              |      Bun |     Deno |  Node.js |
| ------------------ | -------: | -------: | -------: |
| hash (32 B)        |   _0.83_ | **1.07** | **1.45** |
| hash (1 KB)        |   _0.42_ |   _0.93_ | **1.19** |
| hash (64 KB)       |   _0.71_ | **2.63** | **2.59** |
| hash (1 MB)        |   _0.71_ | **3.09** | **2.69** |
| keyed_hash (32 B)  | **3.94** | **2.07** | **6.49** |
| keyed_hash (1 KB)  |   _0.71_ | **1.77** | **2.74** |
| keyed_hash (64 KB) |   _0.71_ | **2.63** | **2.64** |
| keyed_hash (1 MB)  |   _0.71_ | **2.72** | **2.72** |
| derive_key (32 B)  | **2.84** | **2.01** | **5.87** |
| derive_key (1 KB)  |   _0.80_ | **1.75** | **2.61** |
| derive_key (64 KB) |   _0.72_ | **2.68** | **2.84** |
| derive_key (1 MB)  |   _0.71_ | **2.71** | **2.72** |
| streaming (1 KB)   |   _0.93_ | **1.66** | **2.23** |
| streaming (64 KB)  |   _0.70_ | **2.55** | **2.62** |
| streaming (1 MB)   |   _0.69_ | **2.63** | **2.28** |

> 1.0 = blake3_wasm faster, <1.0 = npm:blake3-wasm faster. Bold = we win, italic
> = npm wins.

## SIMD Speedup (blake3_wasm vs blake3_wasm_small)

### One-shot functions

| Group        |    Bun |     Deno |  Node.js |
| ------------ | -----: | -------: | -------: |
| hash (32 B)  | _0.73_ |     1.02 | **1.16** |
| hash (1 KB)  | _0.41_ | **1.07** | **1.10** |
| hash (64 KB) | _0.69_ | **2.57** | **2.52** |
| hash (1 MB)  | _0.69_ | **2.65** | **2.63** |

### Component model

| Group              |    Bun |     Deno |  Node.js |
| ------------------ | -----: | -------: | -------: |
| keyed_hash (32 B)  | _0.77_ |     0.99 | **1.18** |
| keyed_hash (1 KB)  | _0.42_ |     1.05 | **1.14** |
| keyed_hash (64 KB) | _0.69_ | **2.79** | **2.72** |
| keyed_hash (1 MB)  | _0.69_ | **2.65** | **2.62** |
| derive_key (32 B)  | _0.64_ |     1.01 | **1.19** |
| derive_key (1 KB)  | _0.42_ |     1.05 | **1.14** |
| derive_key (64 KB) | _0.79_ | **2.54** | **2.63** |
| derive_key (1 MB)  | _0.69_ | **2.63** | **2.62** |

### Streaming (manual hasher loop)

| Group             |    Bun |     Deno |  Node.js |
| ----------------- | -----: | -------: | -------: |
| streaming (1 KB)  | _0.54_ | **1.15** | **1.38** |
| streaming (64 KB) | _0.68_ | **2.46** | **2.80** |
| streaming (1 MB)  | _0.68_ | **2.57** | **2.22** |

### Stream convenience functions (ReadableStream)

| Group                     |    Bun |     Deno |  Node.js |
| ------------------------- | -----: | -------: | -------: |
| hash_stream (1 KB)        | _0.74_ | **1.12** |     1.00 |
| keyed_hash_stream (1 KB)  | _0.80_ |     1.01 | **1.05** |
| derive_key_stream (1 KB)  | _0.89_ |     1.03 |     1.03 |
| hash_stream (64 KB)       | _0.66_ | **1.99** | **2.27** |
| keyed_hash_stream (64 KB) | _0.71_ | **1.96** | **2.26** |
| derive_key_stream (64 KB) | _0.71_ | **1.99** | **2.26** |
| hash_stream (1 MB)        | _0.69_ | **2.44** | **2.42** |
| keyed_hash_stream (1 MB)  | _0.69_ | **2.44** | **2.42** |
| derive_key_stream (1 MB)  | _0.69_ | **2.44** | **2.41** |

> 1.0 = SIMD faster, <1.0 = SIMD slower (Bun regression). Bold = SIMD wins,
> italic = SIMD loses.

## WASM Binary Sizes

### wasm-bindgen

| Binary            |    Size | vs npm:blake3-wasm |
| ----------------- | ------: | -----------------: |
| blake3_wasm       | 46.8 KB |      +13,532 bytes |
| blake3_wasm_small | 31.8 KB |       -1,827 bytes |
| npm:blake3-wasm   | 33.6 KB |           baseline |

### Component

| Binary           |    Size |
| ---------------- | ------: |
| blake3_component | 81.1 KB |

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
