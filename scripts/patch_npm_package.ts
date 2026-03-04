/**
 * Patches wasm-pack web target output for npm publishing.
 *
 * Creates:
 * - stream.js — stream functions generated from crates/blake3_wasm_core/stream.ts (single source)
 * - index.js — Node.js entry: auto-init via readFileSync + init_sync
 * - browser.js — Browser/default entry: re-exports init() for async init, with init guards
 * - index.d.ts — type declarations for all exports
 *
 * Also patches package.json with proper npm metadata and generates an npm-specific README.
 *
 * Node.js usage: zero-config, WASM is initialized synchronously at module load via readFileSync.
 * Browser usage: call `await init()` once before using hash functions. Works with Vite and other
 * bundlers that handle `new URL('./file.wasm', import.meta.url)` patterns natively.
 *
 * Usage: deno run --allow-read --allow-write scripts/patch_npm_package.ts <pkg-dir>
 *
 * @module
 */

const dir = Deno.args[0];
if (!dir) {
	console.error('Usage: patch_npm_package.ts <pkg-dir>');
	Deno.exit(1);
}

// Detect the package name prefix from the existing wasm-pack output.
// Looks for the main JS file (e.g. blake3_wasm.js, blake3_wasm_small.js).
const entries = [...Deno.readDirSync(dir)];
const main_js = entries.find(
	(e) =>
		e.isFile &&
		e.name.endsWith('.js') &&
		!e.name.includes('_bg') &&
		e.name !== 'index.js' &&
		e.name !== 'browser.js' &&
		e.name !== 'stream.js',
);
if (!main_js) {
	console.error(`No main JS file found in ${dir}`);
	Deno.exit(1);
}

const base = main_js.name.replace(/\.js$/, '');
const wasm_file = `${base}_bg.wasm`;
const dts_file = `${base}.d.ts`;
const is_small = base.includes('small');
const pkg_name = is_small ? '@fuzdev/blake3_wasm_small' : '@fuzdev/blake3_wasm';

// 1. Generate stream.js from the canonical stream.ts (single source of truth).
// Strip TypeScript-specific syntax via targeted transforms. The file is small and stable,
// so explicit replacements are preferable to a general-purpose TS stripper.

const stream_ts_path = new URL('../crates/blake3_wasm_core/stream.ts', import.meta.url);
const stream_ts = Deno.readTextFileSync(stream_ts_path);

const stream_js = stream_ts
	// Remove import type line
	.replace(/^import type \{[^}]+\} from '[^']+';\n\n?/m, '')
	// Remove export interface block (JSDoc comment + interface + body + closing brace)
	.replace(/^\/\*\* Stream function signatures[^]*?^}\n\n/m, '')
	// Strip parameter type annotations: `name: Type` → `name`
	// Handles Blake3HasherInstance, Blake3HasherConstructor, ReadableStream<Uint8Array>
	.replace(/(\w+): (?:Blake3Hasher\w+|ReadableStream<Uint8Array>)/g, '$1')
	// Strip optional callback param type: `check?: () => void` → `check`
	.replace(/check\?: \(\) => void/, 'check')
	// Strip local variable type annotations: `let batch: Uint8Array | null = null`
	.replace(/: Uint8Array \| null/g, '')
	// Strip return type annotations: `): Promise<Uint8Array> {` → `) {`
	.replace(/\): (?:Promise<Uint8Array>|StreamFunctions) \{/g, ') {')
	// Remove non-null assertions before property access: `batch!.` → `batch.`
	.replace(/(\w)!\./g, '$1.');

// Validate: no TypeScript syntax should remain
const ts_patterns = [
	/: Blake3Hasher/,
	/: ReadableStream/,
	/: Promise</,
	/: StreamFunctions/,
	/: Uint8Array/,
	/\w\?\s*:/,
	/\w!\./,
	/import type /,
	/export interface /,
];
for (const pattern of ts_patterns) {
	if (pattern.test(stream_js)) {
		console.error(`FAIL: stream.js still contains TypeScript syntax: ${pattern}`);
		console.error('Update the type-stripping transforms in patch_npm_package.ts');
		Deno.exit(1);
	}
}

Deno.writeTextFileSync(`${dir}/stream.js`, stream_js);
console.log(`Generated ${dir}/stream.js from stream.ts`);

// 2. Create index.js — Node.js entry: auto-init via readFileSync + init_sync.
// WASM is initialized synchronously at import time, so no init guard needed.
const index_js = `import { readFileSync } from 'node:fs';
import {
	default as init,
	initSync,
	Blake3Hasher,
	derive_key,
	hash,
	keyed_hash,
} from './${main_js.name}';
import { make_stream_functions } from './stream.js';

const wasm = readFileSync(new URL('./${wasm_file}', import.meta.url));
initSync({ module: wasm });

export { init, initSync as init_sync, Blake3Hasher, derive_key, hash, keyed_hash };
export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(Blake3Hasher);
`;

Deno.writeTextFileSync(`${dir}/index.js`, index_js);
console.log(`Created ${dir}/index.js`);

// 3. Create browser.js — Browser/default entry: re-exports init() for async initialization.
// Vite and other bundlers pick this via the "default" export condition and handle the
// `new URL('./blake3_wasm_bg.wasm', import.meta.url)` pattern in blake3_wasm.js natively.
// All public API is guarded with _check() so users get a clear error before init().
const browser_js = `import {
	default as _init,
	initSync,
	Blake3Hasher as _Blake3Hasher,
	derive_key as _derive_key,
	hash as _hash,
	keyed_hash as _keyed_hash,
} from './${main_js.name}';
import { make_stream_functions } from './stream.js';

let _ready = false;

function _check() {
	if (!_ready) throw new Error('${pkg_name}: WASM not initialized. Call \\\`await init()\\\` before using hash functions.');
}

/** Initialize the WASM module. Required in browsers before calling hash functions. No-op if already initialized. */
export async function init(...args) {
	if (_ready) return;
	await _init(...args);
	_ready = true;
}

/** Synchronously initialize the WASM module. Works in Workers (not Chrome main thread for >4KB WASM). */
export function init_sync(...args) {
	if (_ready) return;
	initSync(...args);
	_ready = true;
}

// Guarded Blake3Hasher — wraps the wasm-bindgen class to check init state.
// Uses a function-as-constructor pattern so instanceof works (shared prototype).
function Blake3Hasher(...args) {
	_check();
	return new _Blake3Hasher(...args);
}
Blake3Hasher.new_keyed = function (key) {
	_check();
	return _Blake3Hasher.new_keyed(key);
};
Blake3Hasher.new_derive_key = function (context) {
	_check();
	return _Blake3Hasher.new_derive_key(context);
};
Blake3Hasher.prototype = _Blake3Hasher.prototype;
export { Blake3Hasher };

/** Hash data and return the 32-byte digest. */
export function hash(data) { _check(); return _hash(data); }

/** Keyed hash (MAC). Key must be exactly 32 bytes. */
export function keyed_hash(key, data) { _check(); return _keyed_hash(key, data); }

/** Derive a key from context string and key material. Returns 32 bytes. */
export function derive_key(context, key_material) { _check(); return _derive_key(context, key_material); }

export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(_Blake3Hasher, _check);
`;

Deno.writeTextFileSync(`${dir}/browser.js`, browser_js);
console.log(`Created ${dir}/browser.js`);

// 4. Create index.d.ts — type declarations for all exports (covers both node and browser entries).
// Re-exports core API from wasm-bindgen types, but declares init/init_sync with clean signatures
// to avoid leaking wasm-bindgen internals (InitOutput with raw WASM function pointers).
const index_dts = `export {
	Blake3Hasher,
	derive_key,
	hash,
	keyed_hash,
} from './${dts_file}';
/** Initialize the WASM module. Required in browsers before calling hash functions. No-op if already initialized. */
export declare function init(): Promise<void>;
/** Synchronously initialize the WASM module. Works in Node.js and Workers (not Chrome main thread for >4KB WASM). */
export declare function init_sync(module: { module: BufferSource | WebAssembly.Module }): void;
/** Hash a ReadableStream and return the 32-byte digest. */
export declare function hash_stream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array>;
/** Keyed hash a ReadableStream. Key must be exactly 32 bytes. */
export declare function keyed_hash_stream(
	key: Uint8Array,
	stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array>;
/** Derive-key hash a ReadableStream. Returns 32 bytes. */
export declare function derive_key_stream(
	context: string,
	stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array>;
`;

Deno.writeTextFileSync(`${dir}/index.d.ts`, index_dts);
console.log(`Created ${dir}/index.d.ts`);

// 5. Patch package.json
const pkg_path = `${dir}/package.json`;
const pkg = JSON.parse(Deno.readTextFileSync(pkg_path));

pkg.description = 'BLAKE3 hashing compiled to WASM';
pkg.type = 'module';
pkg.exports = {
	'./package.json': './package.json',
	'.': {
		types: './index.d.ts',
		node: './index.js',
		default: './browser.js',
	},
};
pkg.files = [
	'index.js',
	'index.d.ts',
	'browser.js',
	'stream.js',
	main_js.name,
	dts_file,
	wasm_file,
	'README.md',
	'LICENSE',
];
pkg.keywords = [
	'blake3',
	'hash',
	'wasm',
	'webassembly',
	...(is_small ? ['size-optimized'] : ['simd']),
	'streaming',
	'keyed-hash',
	'key-derivation',
];
pkg.homepage = 'https://github.com/fuzdev/blake3';
pkg.author = {
	name: 'Ryan Atkinson',
	email: 'mail@ryanatkn.com',
	url: 'https://www.ryanatkn.com/',
};
pkg.repository = {
	type: 'git',
	url: 'git+https://github.com/fuzdev/blake3.git',
};
pkg.bugs = 'https://github.com/fuzdev/blake3/issues';
pkg.funding = 'https://www.ryanatkn.com/funding';
pkg.engines = { node: '>=20' };

// Remove wasm-pack web target fields superseded by exports
delete pkg.main;
delete pkg.types;
delete pkg.module;

Deno.writeTextFileSync(pkg_path, JSON.stringify(pkg, null, '\t') + '\n');
console.log(`Patched ${pkg_path}`);

// 6. Generate npm README — user-facing content only (no contributor/build sections).
// The repo README includes Building from source, Development, Publish etc. which are
// irrelevant to npm consumers and contain broken relative links on npmjs.com.
const readme_src = new URL('../README.md', import.meta.url).pathname;
const readme_full = Deno.readTextFileSync(readme_src);

const architecture_idx = readme_full.indexOf('\n## Architecture');
if (architecture_idx === -1) {
	console.error('FAIL: could not find "## Architecture" section in README.md');
	console.error('The npm README generation depends on this header as a split point.');
	Deno.exit(1);
}

let npm_body = readme_full
	.slice(0, architecture_idx)
	.replace('# blake3\n', `# ${pkg_name}\n`);

if (is_small) {
	// Replace import paths and WASM filenames so examples match the installed package
	npm_body = npm_body
		.replaceAll("from '@fuzdev/blake3_wasm'", "from '@fuzdev/blake3_wasm_small'")
		.replaceAll("from 'npm:@fuzdev/blake3_wasm'", "from 'npm:@fuzdev/blake3_wasm_small'")
		.replaceAll('blake3_wasm_bg.wasm', 'blake3_wasm_small_bg.wasm');
	// Remove bundler alias tip (not relevant when already using the small build)
	npm_body = npm_body.replace(
		/\nOnly import one[^\n]+\nTo swap builds[^\n]+\n\n```ts\n[\s\S]*?\n```\n/,
		'',
	);
}

const npm_readme = npm_body +
	`
## Benchmarks

Cross-runtime results (Deno, Node.js, Bun, Wasmtime) are available in the
[GitHub repository](https://github.com/fuzdev/blake3/blob/main/benches/results/report.md).

## License

[MIT](https://github.com/fuzdev/blake3/blob/main/LICENSE)
`;

Deno.writeTextFileSync(`${dir}/README.md`, npm_readme);
console.log(`Generated npm README for ${pkg_name}`);

const license_src = new URL('../LICENSE', import.meta.url).pathname;
const license = Deno.readTextFileSync(license_src);
Deno.writeTextFileSync(`${dir}/LICENSE`, license);
console.log(`Copied LICENSE to ${dir}/`);
