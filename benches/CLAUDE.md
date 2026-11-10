# Benchmarks

Cross-runtime BLAKE3 benchmark suite covering Deno, Node.js, Bun, and Wasmtime.

## Quick Start

```bash
npm run bench                      # Full pipeline: build + all runtimes + report
npm run bench:deno                 # Deno only
npm run bench:node                 # Node.js only
npm run bench:bun                  # Bun only
npm run bench:wasmtime             # Wasmtime component model only
npm run bench:report               # Generate cross-runtime comparison report
npm run bench:diff                 # Regression detection between two result files
npm run bench:diff -- --threshold 10 --runtime deno   # flags go after `--`
```

## Structure

```
benches/
├── report.task.ts                 # Cross-runtime report generator (gro task)
├── diff.task.ts                   # Regression detection (gro task; Welch's t-test, Cohen's d)
├── results/                       # Output (json/md gitignored except report.md)
│   ├── {runtime}.json             # Latest results (for report)
│   ├── {ts}_{runtime}_{commit}.{json,md}  # Timestamped history
│   └── report.md                  # Latest cross-runtime report
├── lib/
│   ├── bench_core.ts              # Shared engine (make_runners, run_benchmarks)
│   ├── bench_result.ts            # Result types + shared formatting (pure)
│   ├── report.ts                  # Report rendering (pure)
│   ├── diff.ts                    # Diff rendering (pure)
│   ├── markdown_table.ts          # Markdown table alignment
│   └── color.ts                   # ANSI styling
├── deno/
│   └── bench.ts                   # Deno benchmark entry point
└── node/
    └── bench.ts                   # Node.js / Bun benchmark entry point
```

Wasmtime benchmarks live in `crates/blake3_bench_wasmtime/` (Rust binary).

## Environment Variables

| Variable         | Default                     | Description                          |
| ---------------- | --------------------------- | ------------------------------------ |
| `BENCH_DURATION` | `3000`                      | Duration per benchmark group in ms   |
| `BENCH_WARMUP`   | `10`                        | Warmup iterations before measurement |
| `BENCH_OUTPUT`   | `benches/results/{rt}.json` | JSON output path                     |
| `BENCH_RUNTIME`  | `Node.js`                   | Runtime label (node/bench.ts only)   |

Quick iterations: `BENCH_DURATION=1000 npm run bench:deno`

## Architecture

### Shared engine (`lib/bench_core.ts`)

`make_runners` builds the standard runner array from blake3 profiles and the npm reference.
`run_benchmarks` handles: correctness verification (within verify groups), hash/keyed_hash/derive_key
benchmarks at 4 sizes (32B, 1KB, 64KB, 1MB), streaming benchmarks at 3 sizes with chunking,
stream convenience function benchmarks (hash_stream, keyed_hash_stream, derive_key_stream),
JSON + markdown output with timestamped history.

The harness and the entry points run under Node.js, Bun, and Deno, so they reach the system
through `node:*` modules, which all three support. The result types and the formatting the report
shares with the harness live in `lib/bench_result.ts`, which does no I/O.

### Entry points

All three JS runtimes load our builds through the same web-target entries
(`crates/<crate>/mod.ts`: wasm-pack's web glue, `initSync` over the `.wasm` read with
`node:fs`), so they run identical WASM bytes and identical glue. Instantiation is synchronous and
happens once at import, outside every measurement. The npm reference loads its CJS Node build on
Node.js and Bun (`blake3-wasm`) and its browser build on Deno (`blake3-wasm/browser-async.js`),
which are separate WASM binaries.

### Runners

JS runtimes benchmark 3 implementations:

1. **blake3_wasm** — SIMD build (category: `blake3`)
2. **blake3_wasm_small** — size-optimized, no SIMD (category: `blake3`)
3. **npm:blake3-wasm** — reference package (category: `reference`)

Wasmtime benchmarks the component model build.

### Report (`report.task.ts`)

Auto-discovers `results/*.json`, produces cross-runtime comparison with throughput, confidence
intervals, SIMD speedup table, and WASM binary sizes. History files are saved alongside.
The rendering (`lib/report.ts`) is pure and aligns its own markdown tables
(`lib/markdown_table.ts`), so the saved report needs no markdown formatter.

### Diff (`diff.task.ts`)

Compares two result files for regressions. Uses Welch's t-test for statistical significance
and Cohen's d for effect size. Auto-detects the latest two timestamped files (`--runtime` limits
them to one runtime) or takes two paths, base then current
(`npm run bench:diff -- benches/results/a.json benches/results/b.json`). `--threshold` sets
the regression threshold in percent (default 5). Exits 1 on a significant regression.

## Comparison Caveats

- **npm:blake3-wasm keyed_hash/derive_key** use the streaming API internally (3 wasm boundary
  crossings) vs our one-shot exports (1 call). Explains the large gap at small sizes — real-world
  API design difference, not an algorithm difference.
- **Deno** has ~5-9x higher per-call WASM overhead at small inputs vs Node.js (up to ~8x for hash at 32B). The WASM
  and its glue are identical — this is a Deno runtime characteristic. The gap narrows at large sizes.
- **Bun** has a WASM SIMD regression — blake3_wasm (SIMD) is 1.6-2.6x slower than
  blake3_wasm_small (no SIMD) on Bun (worst range 512B–3KB: ~2.3–2.6x, 32B: ~1.6x,
  64KB+: ~1.44x; 4KB is a notable transition — BLAKE3's 4-chunk parallelism partially
  offsets Bun's SIMD overhead), while SIMD is ~2.6x faster on Deno/Node at 64KB+.

## WASM Boundary Crossing Analysis

### Per-call overhead

Each wasm-bindgen function involves multiple WASM calls due to the generated JS glue:

| Operation            | WASM calls | What they do                                                     |
| -------------------- | ---------: | ---------------------------------------------------------------- |
| `hash(data)`         |          5 | stack_ptr_push, malloc(input), hash, free(output), stack_ptr_pop |
| `update(data)`       |          2 | malloc(input), update                                            |
| `finalize()`         |          4 | stack_ptr_push, finalize, free(output), stack_ptr_pop            |
| `new Blake3Hasher()` |          1 | constructor                                                      |
| `free()`             |          1 | destructor                                                       |
| Streaming (N chunks) |       2N+6 | new(1) + update×N(2N) + finalize(4) + free(1)                    |

Measured per-"call-equivalent" overhead:

| Runtime | hash(32B) / 5 calls | update loop / call |
| ------- | ------------------: | -----------------: |
| Node.js |               ~64ns |              ~53ns |
| Deno    |              ~470ns |             ~101ns |

The `hash()` glue is heavier than `update()` due to try/finally, DataView reads, `.slice()` copy,
and output free. Deno amplifies JS glue overhead ~4-5x vs Node.

### Stream function overhead

The `stream.ts` functions use `reader.read()` in a while loop with batched updates (accumulating
chunks up to 16 KB before calling `update()`). Overhead vs the sync streaming benchmark
(`hash_stream` − `streaming`) includes async `reader.read()` cost, reduced `update()` calls
from batching (e.g. 64 KB test: 4 batched updates vs 8 direct updates), and a **16 KB batch
buffer allocated per call** (`hash_stream_core` allocates lazily on first small chunk). This
allocation is real API cost — only significant when hashing many small fully-buffered streams
in a tight loop (the benchmark amplifies it; real I/O-bound streams are dominated by I/O wait).

| Size (chunks) |     Node.js overhead |        Deno overhead |
| ------------- | -------------------: | -------------------: |
| 1KB (16×64B)  |  ~6μs (~0.4μs/chunk) | ~18μs (~1.1μs/chunk) |
| 64KB (8×8KB)  |  ~9μs (~1.2μs/chunk) | ~24μs (~3.0μs/chunk) |
| 1MB (128×8KB) | ~29μs (~0.2μs/chunk) | ~44μs (~0.3μs/chunk) |

### What the glue code does

`passArray8ToWasm0(data, malloc)`: allocates WASM memory via `__wbindgen_malloc`, copies JS
Uint8Array into WASM linear memory via `TypedArray.set()`. Returns (ptr, len) for the Rust side.

Return values: Rust writes (ptr, len) into a stack-allocated return area. JS reads via `DataView`,
calls `.slice()` to copy from WASM memory to a new JS Uint8Array, then frees the WASM allocation.

`Blake3Hasher`: wraps a single `__wbg_ptr` pointer. Uses `FinalizationRegistry` for automatic
cleanup, with explicit `free()` / `Symbol.dispose` for deterministic release.

### Improvement opportunities

No remaining opportunities — all viable candidates have been evaluated.

### Already implemented

- **Stream chunk batching** (`stream.ts`): accumulates chunks up to 16 KB before calling `update()`,
  reducing boundary crossings for small-chunk streams. (Reduced from 64 KB per Q4 — smaller batch
  buffer allocation significantly outweighs the marginal gain from fewer `update()` calls.)
- **`reader.read()` loop** (`stream.ts`): uses direct `reader.read()` instead of `for await`,
  avoiding async iterator protocol overhead.
- **`finalize_and_reset`** (`lib.rs`): combined finalize + reset in one WASM call for hasher reuse.
- **GC between groups**: `--expose-gc` + `globalThis.gc()` called between benchmark groups
  (Deno, Node.js) to prevent GC pauses from landing inside measurements. Graceful no-op on Bun.
- **Stream fn pre-warmup**: One full-duration throwaway benchmark (`hash_stream` at 1KB,
  results discarded) before the measured stream fn groups. Runs unconditionally — correctness
  over speed. Observed on Bun (first group ~2x slower without it); Bun's async JIT threshold
  is tens of thousands of iterations, unreachable with a fixed iteration count. Adds
  ~duration_ms (~3% overhead) per runtime.

### Evaluated and resolved

- **Combined `finalize_and_free` Rust export**: would save 1 WASM call (the destructor) per
  streaming operation. ~53ns on Node.js, ~100ns on Deno — ~2-5% at small sizes, negligible at
  large. Not worth the API surface increase. (But `finalize_and_reset` was added for reuse.)
- **Input allocation lifecycle (Q1)**: `update()` and `hash()` input allocations are NOT leaked.
  The JS glue doesn't explicitly free, but WASM's dlmalloc reuses freed regions. Empirically
  verified: 100K update(8KB) = 800MB data, only 11 MB RSS growth.
- **Custom JS glue (Q5)**: Pre-allocated static buffers + direct WASM memory writes tried
  (2026-02-22). No measurable improvement — V8 TurboFan already JIT-fuses wasm-bindgen's
  multi-call pattern. The "5 WASM calls" are a static count, not a runtime cost.

### What's NOT improvable

- **Input data copy**: fundamental to WASM memory isolation (dominates at 1MB+)
- **Deno per-call overhead**: V8 configuration difference, identical code
- **Bun SIMD regression**: Bun runtime issue
- **Component model copies**: WIT `list<u8>` semantics require copy in + copy out
- **16KB batch buffer per hash_stream call**: allocated in `hash_stream_core` for batching
  small chunks (reduced from 64KB per Q4). Reuse via a `Blake3StreamHasher` with an owned
  buffer was evaluated and rejected — unsafe for concurrent usage, dominated by I/O in real
  streams, and the manual `Blake3Hasher` + `finalize_and_reset` already covers the tight-loop
  case without it.
