# blake3

[BLAKE3](https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE3) hashing
for TypeScript/JS, compiled to WASM from the
[`blake3`](https://crates.io/crates/blake3) Rust crate,
[@BLAKE3-team/BLAKE3](https://github.com/BLAKE3-team/BLAKE3).

## Install

Two builds with the same API:

```bash
npm i @fuzdev/blake3_wasm        # SIMD — faster, 49 KB
npm i @fuzdev/blake3_wasm_small  # no SIMD — smaller, 34 KB
```

Use `blake3_wasm` unless optimizing bundle size (or using Bun with its current SIMD issue).
It enables blake3's WASM SIMD optimizations and is 2-3x faster on Deno and Node.
`blake3_wasm_small` is ~30% smaller and ~2x faster on Bun (which has a WASM SIMD regression).
See [benchmarks](#benchmarks) for details
(includes a comparison to the SIMD-lacking https://github.com/connor4312/blake3,
`blake3` and `blake3-wasm` on npm).

Also available via `npm:` specifier in Deno:

```ts
import { hash } from 'npm:@fuzdev/blake3_wasm';
```

Only import one — importing both loads two separate WASM modules.
To swap builds without changing imports, use a bundler alias:

```ts
// vite.config.ts — use the small build everywhere
export default {
	resolve: {
		alias: { '@fuzdev/blake3_wasm': '@fuzdev/blake3_wasm_small' },
	},
};
```

## Usage

```ts
import { Blake3Hasher, derive_key, hash, keyed_hash } from '@fuzdev/blake3_wasm';

// one-shot hash — returns 32-byte Uint8Array
const digest = hash(new TextEncoder().encode('hello'));
console.log(digest.length); // 32

// keyed hash (MAC) — key must be 32 bytes
const key = new Uint8Array(32);
const mac = keyed_hash(key, new TextEncoder().encode('hello'));

// key derivation
const derived = derive_key('my-app', new TextEncoder().encode('secret'));

// streaming hasher — same result as one-shot above
const hasher = new Blake3Hasher();
hasher.update(new TextEncoder().encode('hel'));
hasher.update(new TextEncoder().encode('lo'));
const result = hasher.finalize(); // same bytes as `digest`
hasher.free(); // release WASM memory, or use `using` — see API below
```

### Browser

In browsers, call `init()` once before using any hash functions.
It's a no-op if already initialized, so calling it unconditionally is safe.

```ts
import { hash, init } from '@fuzdev/blake3_wasm';

await init();

const digest = hash(new TextEncoder().encode('hello'));
```

Node and Deno initialize automatically — `init()` is only needed in browsers.
The browser entry uses `new URL('./blake3_wasm_bg.wasm', import.meta.url)` internally,
which Vite and webpack handle automatically. Other bundlers may need a plugin for WASM assets.

For synchronous initialization in Web Workers, use `init_sync`:

```ts
import { init_sync } from '@fuzdev/blake3_wasm';

const wasm = await fetch('/blake3_wasm_bg.wasm').then((r) => r.arrayBuffer());
init_sync({ module: wasm });
```

### Hashing a `ReadableStream`

```ts
import { derive_key_stream, hash_stream, keyed_hash_stream } from '@fuzdev/blake3_wasm';

// file: File from <input>, drop event, or fetch Response
const digest = await hash_stream(file.stream());
const mac = await keyed_hash_stream(key, file.stream());
const derived = await derive_key_stream('my-app', file.stream());
```

## API

All functions return 32-byte (256-bit) digests. BLAKE3 supports variable-length output (XOF)
but this API does not currently expose it — 32 bytes covers most use cases and XOF may be added
in the future.

### One-shot functions

```ts
hash(data: Uint8Array): Uint8Array
```

Returns 32-byte digest.

```ts
keyed_hash(key: Uint8Array, data: Uint8Array): Uint8Array
```

Keyed hash (MAC). Throws if key is not exactly 32 bytes.

```ts
derive_key(context: string, key_material: Uint8Array): Uint8Array
```

Key derivation. Returns 32 bytes.

### Streaming hasher

```ts
const hasher = new Blake3Hasher();
```

Create a hasher for plain hashing.

```ts
Blake3Hasher.new_keyed(key: Uint8Array): Blake3Hasher
```

Keyed hasher (MAC). Throws if key is not exactly 32 bytes.

```ts
Blake3Hasher.new_derive_key(context: string): Blake3Hasher
```

Hasher in key derivation mode.

```ts
hasher.update(data: Uint8Array): void
```

Feed data incrementally.

```ts
hasher.finalize(): Uint8Array
```

Returns 32-byte digest. Non-destructive — can call repeatedly.

```ts
hasher.finalize_and_reset(): Uint8Array
```

Finalize and reset in one call.

```ts
hasher.reset(): void
```

Reset to initial state. Preserves keyed/derive mode.

```ts
hasher.free(): void
```

Release WASM memory. Supports [`using`](https://github.com/tc39/proposal-explicit-resource-management)
for automatic cleanup:

```ts
using hasher = new Blake3Hasher();
hasher.update(data);
return hasher.finalize();
// hasher.free() called automatically
```

### Stream functions

```ts
hash_stream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array>
```

Hash a stream. Returns 32-byte digest.

```ts
keyed_hash_stream(key: Uint8Array, stream: ReadableStream<Uint8Array>): Promise<Uint8Array>
```

Keyed hash a stream. Key must be exactly 32 bytes. Returns 32-byte digest.

```ts
derive_key_stream(context: string, stream: ReadableStream<Uint8Array>): Promise<Uint8Array>
```

Derive-key hash a stream. Returns 32-byte digest.

Stream functions handle hasher cleanup automatically, even if the stream throws mid-read.

## Architecture

See [docs/architecture.md](docs/architecture.md) for crate structure, build pipeline, and tooling details.

## Building from source

Requires [Rust](https://rustup.rs/), [wasm-pack](https://drager.github.io/wasm-pack/installer/),
[Deno](https://deno.land/), and the WASM target (`rustup target add wasm32-unknown-unknown`).

```bash
deno task build:wasm           # build all WASM targets
deno task build:wasm:deno      # build for Deno (+ deno compile patch)
deno task build:wasm:web       # build for web/Node (+ npm package)
```

The Deno build patches wasm-bindgen's `fetch()` to `Deno.readFileSync()` for
[`deno compile`](https://docs.deno.com/runtime/reference/cli/compile/) compatibility.
Include the `pkg/deno/` directory via `--include` so the WASM binary is embedded:

```bash
deno compile --allow-read --include=path/to/pkg/deno my_script.ts
```

For WASI component builds and Wasmtime benchmarks, also install
[`cargo-component`](https://github.com/bytecodealliance/cargo-component)
and add the WASI target (`rustup target add wasm32-wasip1`).

## Development

```bash
cargo check --workspace        # fast typecheck
deno task check                # full check (typecheck + test:rust + clippy + fmt)
deno task compare              # build + correctness: all builds vs test vectors
deno task test                 # all correctness tests (requires built artifacts)
deno task validate             # everything: check + build + test + validate:*
deno task bench                # performance: cross-runtime benchmarks
```

## Benchmarks

One snapshot of cross-runtime results (Deno, Node, Bun, Wasmtime) is in
[benches/results/report.md](benches/results/report.md).

```bash
deno task bench                # full pipeline: build + all runtimes + report
deno task bench:deno           # Deno only
deno task bench:report         # regenerate report from existing results
```

## Publish

Uses [changesets](https://github.com/changesets/changesets) for version management.
Prerequisite: `npm i -g @changesets/cli`

```bash
changeset                      # add a changeset
deno task publish              # dry-run
deno task publish --wetrun     # version + check + build + validate + publish
```

## License

[MIT](LICENSE)
