# Scripts

Build, validation, and publishing scripts for the blake3 WASM packages. All scripts
are Deno TypeScript (except `test_npm.js` which runs in Node.js).

## Scripts

### Build

| Script          | Task                   | Purpose                                                                                                                             |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `build_wasm.ts` | `deno task build:wasm` | Parallel WASM build orchestrator — runs blake3_wasm and blake3_wasm_small concurrently, deno + web targets sequentially within each |

### Post-Build Patches

| Script                  | Runs after                                 | Purpose                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `patch_deno_compile.ts` | `build:wasm:deno`, `build:wasm:small:deno` | Replaces wasm-bindgen's `fetch()` with `Deno.readFileSync()` for `deno compile` compat; creates `_bg.js` stub for module resolution                                                                    |
| `patch_npm_package.ts`  | `build:wasm:web`, `build:wasm:small:web`   | Generates `stream.js` (from `blake3_wasm_core/stream.ts`), `index.js` (Node auto-init), `browser.js` (guarded exports), `index.d.ts`, npm README; patches `package.json` with metadata and exports map |

### Correctness

| Script        | Task                                      | Purpose                                                                                                                                                          |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compare.ts`  | `deno task test:deno` / `test:deno:small` | Deno.test suite verifying hash, keyed_hash, derive_key, streaming, stream functions (incl. batch boundaries), and error paths against native blake3 test vectors |
| `test_npm.js` | `deno task test:npm` / `test:npm:small`   | Node.js test runner (`node --test`) for the built `pkg/web/` — tests both `index.js` (auto-init) and `browser.js` (init guard) entries                           |

### Validation

| Script                      | Task                         | Purpose                                                                                                                                                     |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate_wasm_size.ts`     | `deno task validate:size`    | WASM binary size regression checks (±10 KB tolerance), SIMD vs small relative size check, npm package structure verification                                |
| `validate_deno_compile.ts`  | `deno task validate:compile` | Smoke test for both blake3_wasm and blake3_wasm_small: compiles a minimal script with `deno compile --include`, runs the binary, checks correct hash output |
| `validate_bench_results.ts` | `deno task validate:bench`   | Schema validation for bench JSON output — catches Rust/TS struct drift                                                                                      |

### Publishing

| Script       | Task                | Purpose                                                                                                                                                                                    |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `publish.ts` | `deno task publish` | Unified publish pipeline: preflight → changeset version → version sync (Cargo.toml, jsr.json) → check → build → verify → validate → npm publish. Dry-run by default, `--wetrun` to publish |

## Conventions

- Scripts use `node:process` and `node:fs` for cross-runtime compat (Deno supports these)
- `patch_npm_package.ts` does targeted type stripping on `stream.ts` rather than using a
  general-purpose TS stripper — the file is small and stable
- `patch_deno_compile.ts` uses pattern matching (not filename heuristics) to find the file to patch
- `publish.ts` uses a `.changeset/.publish-in-progress` sentinel for crash recovery — detects
  retry mode when the sentinel version matches `package.json`
- `test_npm.js` is plain JS (runs in Node.js via `node --test`), uses `PKG_DIR` env var to
  select which package to test
- All validation scripts exit 0 on skip (unbuilt targets), exit 1 on failure
