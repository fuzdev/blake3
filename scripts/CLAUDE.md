# Scripts

Build, validation, and publishing tooling for the blake3 WASM packages. The tooling is
gro tasks (`*.task.ts`), run by path (`gro task scripts/foo.task.ts`, which the `package.json`
scripts wrap), plus Node.js tests run with `node --test`.

## Tasks

| Task                             | Script                                                          | Purpose                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build_wasm.task.ts`             | `npm run build:wasm`                                            | Parallel WASM build orchestrator — runs `build:wasm:simd` and `build:wasm:small` concurrently, each output captured and printed on failure                                                                                                                                                                                                                 |
| `patch_npm_package.task.ts`      | runs after `wasm-pack` in `build:wasm:simd`, `build:wasm:small` | Generates `stream.js` (from `blake3_wasm_core/stream.ts`), `index.js` (Node auto-init), `browser.js` (guarded exports), `index.d.ts`, npm README; patches `package.json` with the kebab-case npm `name` (wasm-pack emits the crate name), metadata, exports map, and `sideEffects: ['./index.js']` (protects the Node entry's auto-init from tree-shaking) |
| `validate_wasm_size.task.ts`     | `npm run validate:size`                                         | WASM binary size regression checks (±10 KB tolerance), SIMD vs small relative size check, npm package structure verification                                                                                                                                                                                                                               |
| `validate_bench_results.task.ts` | `npm run validate:bench`                                        | Schema validation for bench JSON output — catches Rust/TS struct drift                                                                                                                                                                                                                                                                                     |
| `release.task.ts`                | `npm run release`                                               | Release pipeline: preflight → changeset version → version sync (Cargo.toml) → check → build → verify → validate → npm publish. Dry-run by default, `npm run release -- --wetrun` to publish                                                                                                                                                                |

Each task file is a thin composition root: it imports gro's host modules (`@fuzdev/gro/fs.ts`,
`spawn.ts`) and hands handles and programs to the logic in `lib/`, which imports none of them:

| Module                         | Logic                                                                  |
| ------------------------------ | ---------------------------------------------------------------------- |
| `lib/npm_package.ts`           | The npm package's generated files and `package.json` patch             |
| `lib/wasm_size.ts`             | The size and structure checks over a read-only project handle          |
| `lib/bench_result_validate.ts` | The bench result schema check over parsed JSON                         |
| `lib/release.ts`               | The release pipeline over a project handle and `git`/`npm`/`changeset` |

## Tests

| File              | Script                                      | Purpose                                                                                                                                                                                        |
| ----------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_wasm.ts`    | `npm run test:wasm` / `test:wasm:small`     | `node:test` suite verifying hash, keyed_hash, derive_key, streaming, stream functions (incl. batch boundaries), and error paths against native blake3 test vectors, through a crate's `mod.ts` |
| `test_npm.js`     | `npm run test:npm` / `test:npm:small`       | Node.js tests for the built `pkg/` — tests both `index.js` (auto-init) and `browser.js` (init guard) entries                                                                                   |
| `test_tooling.ts` | `npm run test:tooling` (in `npm run check`) | Unit tests for `scripts/lib/` and `benches/lib/` and the release task's flags; the release pipeline runs only against fake programs and a temp directory                                       |

## Conventions

- Tasks reach the system only through gro's host modules, so they can run on gro's own runtime;
  library code takes what it needs as parameters (`FsDir`/`FsReadDir` handles, `SpawnProgram`s)
- A task's flags are its exported `Args` schema (fuz_schema), which refuses unknown flags, so a
  misspelled `--wetrun` fails instead of running a dry run; `--help` lists them
- The test files aren't named `*.test.ts`, which gro would read as a vitest suite; they run with
  `node --test`, and `test_wasm.ts` and `test_npm.js` take the crate or package to test from an
  env var (`CRATE_DIR`, `PKG_DIR`) since `node --test` passes no arguments to a test file
- `lib/npm_package.ts` does targeted type stripping on `stream.ts` rather than using a
  general-purpose TS stripper — the file is small and stable
- `lib/release.ts` uses a `.changeset/.release-in-progress` sentinel for crash recovery — detects
  retry mode when the sentinel version matches `package.json`
- The validators exit 1 when there's nothing to validate (an unbuilt package, no bench results),
  as on a failure, so a gate never passes by skipping
