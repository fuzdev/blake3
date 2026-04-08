# BLAKE3 Cross-Runtime Benchmark Report

**Date:** 2026-04-08

- **Bun**: 2026-04-08T15:05:39.534Z
- **Deno**: 2026-04-08T15:01:15.698Z
- **Node.js**: 2026-04-08T15:03:20.592Z
- **Wasmtime**: 2026-04-08T15:06:25.000Z

## One-shot functions

### hash (32 B)

| Runner            |                     Bun |                    Deno |              Node.js |             Wasmtime |
| ----------------- | ----------------------: | ----------------------: | -------------------: | -------------------: |
| blake3_wasm       | 69 MB/s (0.46μs) (0.74) | 12 MB/s (2.61μs) (0.13) | **94 MB/s** (0.34μs) |                  N/A |
| blake3_wasm_small |    **84 MB/s** (0.38μs) | 13 MB/s (2.46μs) (0.15) | **82 MB/s** (0.39μs) |                  N/A |
| npm:blake3-wasm   |    **66 MB/s** (0.48μs) | 12 MB/s (2.58μs) (0.18) | **68 MB/s** (0.47μs) |                  N/A |
| blake3_component  |                     N/A |                     N/A |                  N/A | **94 MB/s** (0.34μs) |

### hash (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 252 MB/s (4.06μs) (0.32) | 373 MB/s (2.74μs) (0.48) | **783 MB/s** (1.31μs) |                   N/A |
| blake3_wasm_small | 478 MB/s (2.14μs) (0.73) | 282 MB/s (3.63μs) (0.43) | **659 MB/s** (1.55μs) |                   N/A |
| npm:blake3-wasm   | 444 MB/s (2.31μs) (0.72) | 316 MB/s (3.24μs) (0.51) | **620 MB/s** (1.65μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **618 MB/s** (1.66μs) |

### hash (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |                 Wasmtime |
| ----------------- | -------------------------: | --------------------------: | -----------------------: | -----------------------: |
| blake3_wasm       | 456 MB/s (143.76μs) (0.21) | 2,022 MB/s (32.40μs) (0.94) | **2,148 MB/s** (30.51μs) |                      N/A |
| blake3_wasm_small | 531 MB/s (123.37μs) (0.61) |      **829 MB/s** (79.06μs) |   **871 MB/s** (75.23μs) |                      N/A |
| npm:blake3-wasm   | 519 MB/s (126.25μs) (0.62) |      **817 MB/s** (80.26μs) |   **838 MB/s** (78.18μs) |                      N/A |
| blake3_component  |                        N/A |                         N/A |                      N/A | **1,205 MB/s** (54.38μs) |

### hash (1 MB)

| Runner            |                                Bun |                                Deno |                          Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ----------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 453 MB/s (2312.57μs ±0.3μs) (0.21) | 1,715 MB/s (611.28μs ±0.1μs) (0.81) | **2,124 MB/s** (493.67μs ±0.1μs) |                              N/A |
| blake3_wasm_small | 529 MB/s (1983.12μs ±0.1μs) (0.61) |     **849 MB/s** (1235.59μs ±0.2μs) |  **864 MB/s** (1214.23μs ±0.1μs) |                              N/A |
| npm:blake3-wasm   | 516 MB/s (2033.69μs ±0.1μs) (0.62) |     **831 MB/s** (1262.08μs ±0.1μs) |  **833 MB/s** (1259.00μs ±0.1μs) |                              N/A |
| blake3_component  |                                N/A |                                 N/A |                              N/A | **1,208 MB/s** (868.23μs ±0.1μs) |

## Component model

| Group              |                              Bun |                             Deno |                          Node.js |                         Wasmtime |
| ------------------ | -------------------------------: | -------------------------------: | -------------------------------: | -------------------------------: |
| keyed_hash (32 B)  |             **56 MB/s** (0.57μs) |             **15 MB/s** (2.15μs) |             **93 MB/s** (0.34μs) |             **71 MB/s** (0.45μs) |
| keyed_hash (1 KB)  |            **254 MB/s** (4.04μs) |            **324 MB/s** (3.16μs) |            **843 MB/s** (1.21μs) |            **548 MB/s** (1.87μs) |
| keyed_hash (64 KB) |          **456 MB/s** (143.80μs) |         **2,011 MB/s** (32.59μs) |         **2,170 MB/s** (30.20μs) |         **1,089 MB/s** (60.17μs) |
| keyed_hash (1 MB)  | **411 MB/s** (2550.90μs ±11.2μs) |        **2,048 MB/s** (511.88μs) | **2,122 MB/s** (494.26μs ±0.2μs) | **1,087 MB/s** (964.25μs ±2.2μs) |
| derive_key (32 B)  |             **42 MB/s** (0.76μs) |             **14 MB/s** (2.28μs) |             **66 MB/s** (0.48μs) |             **66 MB/s** (0.48μs) |
| derive_key (1 KB)  |            **209 MB/s** (4.90μs) |            **324 MB/s** (3.16μs) |            **693 MB/s** (1.48μs) |            **567 MB/s** (1.81μs) |
| derive_key (64 KB) |          **454 MB/s** (144.50μs) |         **2,008 MB/s** (32.64μs) |         **2,145 MB/s** (30.55μs) |         **1,086 MB/s** (60.34μs) |
| derive_key (1 MB)  |  **453 MB/s** (2315.54μs ±0.3μs) | **2,055 MB/s** (510.21μs ±0.1μs) | **2,114 MB/s** (495.98μs ±0.1μs) | **1,094 MB/s** (958.20μs ±2.1μs) |

## Streaming (manual hasher loop)

### streaming (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |              Wasmtime |
| ----------------- | -----------------------: | -----------------------: | --------------------: | --------------------: |
| blake3_wasm       | 218 MB/s (4.70μs) (0.38) | 278 MB/s (3.68μs) (0.49) | **569 MB/s** (1.80μs) |                   N/A |
| blake3_wasm_small | 323 MB/s (3.17μs) (0.85) | 231 MB/s (4.42μs) (0.61) | **379 MB/s** (2.70μs) |                   N/A |
| npm:blake3-wasm   | 189 MB/s (5.43μs) (0.86) | 141 MB/s (7.27μs) (0.64) | **219 MB/s** (4.67μs) |                   N/A |
| blake3_component  |                      N/A |                      N/A |                   N/A | **183 MB/s** (5.60μs) |

### streaming (64 KB)

| Runner            |                        Bun |                     Deno |                  Node.js |                 Wasmtime |
| ----------------- | -------------------------: | -----------------------: | -----------------------: | -----------------------: |
| blake3_wasm       | 447 MB/s (146.70μs) (0.22) | **1,949 MB/s** (33.62μs) | **2,008 MB/s** (32.64μs) |                      N/A |
| blake3_wasm_small | 526 MB/s (124.50μs) (0.61) |   **827 MB/s** (79.28μs) |   **862 MB/s** (76.06μs) |                      N/A |
| npm:blake3-wasm   | 512 MB/s (128.08μs) (0.61) |   **800 MB/s** (81.94μs) |   **832 MB/s** (78.72μs) |                      N/A |
| blake3_component  |                        N/A |                      N/A |                      N/A | **1,120 MB/s** (58.51μs) |

### streaming (1 MB)

| Runner            |                                Bun |                            Deno |                          Node.js |                         Wasmtime |
| ----------------- | ---------------------------------: | ------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 445 MB/s (2355.60μs ±0.4μs) (0.21) |       **2,073 MB/s** (505.80μs) | **2,082 MB/s** (503.55μs ±0.1μs) |                              N/A |
| blake3_wasm_small | 527 MB/s (1990.91μs ±0.1μs) (0.61) | **849 MB/s** (1235.60μs ±0.1μs) |  **865 MB/s** (1212.40μs ±0.1μs) |                              N/A |
| npm:blake3-wasm   | 516 MB/s (2031.05μs ±0.2μs) (0.61) | **831 MB/s** (1261.64μs ±0.1μs) |  **844 MB/s** (1241.75μs ±0.1μs) |                              N/A |
| blake3_component  |                                N/A |                             N/A |                              N/A | **1,126 MB/s** (931.13μs ±0.1μs) |

## Stream convenience functions (ReadableStream)

### hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 77 MB/s (13.35μs) (0.53) | 72 MB/s (14.14μs) (0.50) | **144 MB/s** (7.11μs) |
| blake3_wasm_small | 86 MB/s (11.92μs) (0.62) | 70 MB/s (14.71μs) (0.51) | **138 MB/s** (7.44μs) |

### keyed_hash_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 76 MB/s (13.48μs) (0.55) | 65 MB/s (15.81μs) (0.47) | **139 MB/s** (7.37μs) |
| blake3_wasm_small | 84 MB/s (12.16μs) (0.62) | 66 MB/s (15.55μs) (0.49) | **135 MB/s** (7.59μs) |

### derive_key_stream (1 KB)

| Runner            |                      Bun |                     Deno |               Node.js |
| ----------------- | -----------------------: | -----------------------: | --------------------: |
| blake3_wasm       | 76 MB/s (13.50μs) (0.55) | 72 MB/s (14.18μs) (0.52) | **138 MB/s** (7.41μs) |
| blake3_wasm_small | 82 MB/s (12.48μs) (0.65) | 67 MB/s (15.23μs) (0.53) | **127 MB/s** (8.09μs) |

### hash_stream (64 KB)

| Runner            |                        Bun |                        Deno |                  Node.js |
| ----------------- | -------------------------: | --------------------------: | -----------------------: |
| blake3_wasm       | 418 MB/s (156.65μs) (0.24) | 1,210 MB/s (54.15μs) (0.70) | **1,726 MB/s** (37.98μs) |
| blake3_wasm_small | 484 MB/s (135.29μs) (0.61) |  603 MB/s (108.71μs) (0.76) |   **793 MB/s** (82.61μs) |

### keyed_hash_stream (64 KB)

| Runner            |                        Bun |                             Deno |                  Node.js |
| ----------------- | -------------------------: | -------------------------------: | -----------------------: |
| blake3_wasm       | 416 MB/s (157.49μs) (0.24) |      1,298 MB/s (50.49μs) (0.76) | **1,717 MB/s** (38.18μs) |
| blake3_wasm_small | 484 MB/s (135.53μs) (0.61) | 666 MB/s (98.46μs ±0.1μs) (0.84) |   **793 MB/s** (82.63μs) |

### derive_key_stream (64 KB)

| Runner            |                        Bun |                             Deno |                  Node.js |
| ----------------- | -------------------------: | -------------------------------: | -----------------------: |
| blake3_wasm       | 417 MB/s (157.28μs) (0.24) |      1,301 MB/s (50.38μs) (0.76) | **1,707 MB/s** (38.39μs) |
| blake3_wasm_small | 484 MB/s (135.53μs) (0.61) | 656 MB/s (99.95μs ±0.1μs) (0.83) |   **793 MB/s** (82.68μs) |

### hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                             Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | ----------------------------------: |
| blake3_wasm       | 441 MB/s (2377.69μs ±0.4μs) (0.23) | **1,913 MB/s** (548.08μs ±0.1μs) | 1,674 MB/s (626.56μs ±0.3μs) (0.87) |
| blake3_wasm_small | 515 MB/s (2035.13μs ±0.2μs) (0.62) |  **820 MB/s** (1277.98μs ±0.1μs) |     **833 MB/s** (1258.86μs ±0.1μs) |

### keyed_hash_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 441 MB/s (2379.04μs ±0.4μs) (0.23) | **1,911 MB/s** (548.78μs ±0.1μs) | **1,913 MB/s** (548.24μs ±0.1μs) |
| blake3_wasm_small | 515 MB/s (2034.87μs ±0.2μs) (0.62) |  **820 MB/s** (1279.35μs ±0.1μs) |  **833 MB/s** (1259.34μs ±0.1μs) |

### derive_key_stream (1 MB)

| Runner            |                                Bun |                             Deno |                          Node.js |
| ----------------- | ---------------------------------: | -------------------------------: | -------------------------------: |
| blake3_wasm       | 441 MB/s (2379.63μs ±0.4μs) (0.23) | **1,911 MB/s** (548.69μs ±0.1μs) | **1,912 MB/s** (548.41μs ±0.1μs) |
| blake3_wasm_small | 515 MB/s (2034.73μs ±0.2μs) (0.62) |  **820 MB/s** (1278.38μs ±0.1μs) |  **833 MB/s** (1259.15μs ±0.1μs) |

## Runtime Comparison

```text
RUNTIME COMPARISON (blake3_wasm):

  hash (32 B):
    Bun       █████████████████████████████░░░░░░░░░░░  69 MB/s  0.46μs  0.74
    Deno      █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12 MB/s  2.61μs  0.13
    Node.js   ████████████████████████████████████████  94 MB/s  0.34μs  1.0

  hash (1 KB):
    Bun       █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  252 MB/s  4.06μs  0.32
    Deno      ███████████████████░░░░░░░░░░░░░░░░░░░░░  373 MB/s  2.74μs  0.48
    Node.js   ████████████████████████████████████████  783 MB/s  1.31μs  1.0

  hash (64 KB):
    Bun       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    456 MB/s  143.76μs  0.21
    Deno      ██████████████████████████████████████░░  2,022 MB/s   32.40μs  0.94
    Node.js   ████████████████████████████████████████  2,148 MB/s   30.51μs  1.0

  hash (1 MB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    453 MB/s  2312.57μs  0.21
    Deno      ████████████████████████████████░░░░░░░░  1,715 MB/s   611.28μs  0.81
    Node.js   ████████████████████████████████████████  2,124 MB/s   493.67μs  1.0

  streaming (1 KB):
    Bun       ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░  218 MB/s  4.70μs  0.38
    Deno      ████████████████████░░░░░░░░░░░░░░░░░░░░  278 MB/s  3.68μs  0.49
    Node.js   ████████████████████████████████████████  569 MB/s  1.80μs  1.0

  streaming (64 KB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    447 MB/s  146.70μs  0.22
    Deno      ███████████████████████████████████████░  1,949 MB/s   33.62μs  1.0
    Node.js   ████████████████████████████████████████  2,008 MB/s   32.64μs  1.0

  streaming (1 MB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    445 MB/s  2355.60μs  0.21
    Deno      ████████████████████████████████████████  2,073 MB/s   505.80μs  1.0
    Node.js   ████████████████████████████████████████  2,082 MB/s   503.55μs  1.0

  hash_stream (1 KB):
    Bun       █████████████████████░░░░░░░░░░░░░░░░░░░   77 MB/s  13.35μs  0.53
    Deno      ████████████████████░░░░░░░░░░░░░░░░░░░░   72 MB/s  14.14μs  0.50
    Node.js   ████████████████████████████████████████  144 MB/s   7.11μs  1.0

  hash_stream (64 KB):
    Bun       ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    418 MB/s  156.65μs  0.24
    Deno      ████████████████████████████░░░░░░░░░░░░  1,210 MB/s   54.15μs  0.70
    Node.js   ████████████████████████████████████████  1,726 MB/s   37.98μs  1.0

  hash_stream (1 MB):
    Bun       █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    441 MB/s  2377.69μs  0.23
    Deno      ████████████████████████████████████████  1,913 MB/s   548.08μs  1.0
    Node.js   ███████████████████████████████████░░░░░  1,674 MB/s   626.56μs  0.87
```

## vs npm:blake3-wasm (blake3_wasm speedup)

| Group              |      Bun |     Deno |  Node.js |
| ------------------ | -------: | -------: | -------: |
| hash (32 B)        |     1.04 |     0.99 | **1.39** |
| hash (1 KB)        |   _0.57_ | **1.18** | **1.26** |
| hash (64 KB)       |   _0.88_ | **2.48** | **2.56** |
| hash (1 MB)        |   _0.88_ | **2.06** | **2.55** |
| keyed_hash (32 B)  | **3.82** | **2.08** | **6.17** |
| keyed_hash (1 KB)  |     0.95 | **2.00** | **2.88** |
| keyed_hash (64 KB) |     1.01 | **2.54** | **2.62** |
| keyed_hash (1 MB)  |   _0.80_ | **2.48** | **2.52** |
| derive_key (32 B)  | **4.15** | **2.03** | **5.56** |
| derive_key (1 KB)  |     0.99 | **1.82** | **2.48** |
| derive_key (64 KB) |   _0.89_ | **2.53** | **2.60** |
| derive_key (1 MB)  |   _0.88_ | **2.48** | **2.51** |
| streaming (1 KB)   | **1.15** | **1.97** | **2.59** |
| streaming (64 KB)  |   _0.87_ | **2.44** | **2.41** |
| streaming (1 MB)   |   _0.86_ | **2.49** | **2.47** |

> 1.0 = blake3_wasm faster, <1.0 = npm:blake3-wasm faster. Bold = we win, italic
> = npm wins.

## SIMD Speedup (blake3_wasm vs blake3_wasm_small)

### One-shot functions

| Group        |    Bun |     Deno |  Node.js |
| ------------ | -----: | -------: | -------: |
| hash (32 B)  | _0.82_ |   _0.94_ | **1.15** |
| hash (1 KB)  | _0.53_ | **1.32** | **1.19** |
| hash (64 KB) | _0.86_ | **2.44** | **2.47** |
| hash (1 MB)  | _0.86_ | **2.02** | **2.46** |

### Component model

| Group              |    Bun |     Deno |  Node.js |
| ------------------ | -----: | -------: | -------: |
| keyed_hash (32 B)  | _0.88_ |     1.04 | **1.17** |
| keyed_hash (1 KB)  | _0.54_ | **1.08** | **1.20** |
| keyed_hash (64 KB) | _0.92_ | **2.42** | **2.49** |
| keyed_hash (1 MB)  | _0.78_ | **2.42** | **2.48** |
| derive_key (32 B)  | _0.89_ |     1.05 | **1.20** |
| derive_key (1 KB)  | _0.53_ | **1.09** | **1.18** |
| derive_key (64 KB) | _0.85_ | **2.42** | **2.47** |
| derive_key (1 MB)  | _0.86_ | **2.43** | **2.47** |

### Streaming (manual hasher loop)

| Group             |    Bun |     Deno |  Node.js |
| ----------------- | -----: | -------: | -------: |
| streaming (1 KB)  | _0.68_ | **1.20** | **1.50** |
| streaming (64 KB) | _0.85_ | **2.36** | **2.33** |
| streaming (1 MB)  | _0.85_ | **2.44** | **2.41** |

### Stream convenience functions (ReadableStream)

| Group                     |    Bun |     Deno |  Node.js |
| ------------------------- | -----: | -------: | -------: |
| hash_stream (1 KB)        | _0.89_ |     1.04 |     1.05 |
| keyed_hash_stream (1 KB)  | _0.90_ |     0.98 |     1.03 |
| derive_key_stream (1 KB)  | _0.92_ | **1.07** | **1.09** |
| hash_stream (64 KB)       | _0.86_ | **2.01** | **2.17** |
| keyed_hash_stream (64 KB) | _0.86_ | **1.95** | **2.16** |
| derive_key_stream (64 KB) | _0.86_ | **1.98** | **2.15** |
| hash_stream (1 MB)        | _0.86_ | **2.33** | **2.01** |
| keyed_hash_stream (1 MB)  | _0.86_ | **2.33** | **2.30** |
| derive_key_stream (1 MB)  | _0.86_ | **2.33** | **2.30** |

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
