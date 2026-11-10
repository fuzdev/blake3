/**
 * Turns wasm-pack's web target output into the published npm package.
 *
 * Generates, beside wasm-pack's files:
 * - `stream.js`, the stream functions, from `crates/blake3_wasm_core/stream.ts` by targeted
 *   type stripping, so the TypeScript stays the one source
 * - `index.js`, the Node entry, initialized synchronously at import via `readFileSync` + `init_sync`
 * - `browser.js`, the browser and default entry, which needs `await init()` before use and
 *   guards every export until then
 * - `index.d.ts`, the declarations for both entries
 * - `README.md`, the repo README's user-facing part, and `LICENSE`
 *
 * and patches `package.json` with the npm name, metadata, and exports map.
 * Browser usage works with Vite and other bundlers that handle the
 * `new URL('./file.wasm', import.meta.url)` pattern natively.
 *
 * @module
 */

import type { FsDir, FsReadDir } from '@fuzdev/gro/fs.ts';
import { TaskError } from '@fuzdev/gro/task.ts';

/** The repo files the package is generated from, relative to the project. */
export const NPM_PACKAGE_SOURCES = {
	stream_ts: 'crates/blake3_wasm_core/stream.ts',
	readme: 'README.md',
	license: 'LICENSE'
} as const;

/** The names wasm-pack gave the package's files, from its main JS file. */
export interface WasmPackFiles {
	/** The generated JS glue, like `blake3_wasm.js`. */
	main_js: string;
	/** Its declarations, like `blake3_wasm.d.ts`. */
	dts_file: string;
	/** The binary, like `blake3_wasm_bg.wasm`. */
	wasm_file: string;
	/** The npm package name, kebab-case where the crate is snake_case. */
	pkg_name: string;
	/** Whether this is the size-optimized build. */
	is_small: boolean;
}

/**
 * Finds wasm-pack's main JS file among a package directory's file names and derives the rest.
 * @returns the files, or `null` when no main JS file is among `names`
 */
export const to_wasm_pack_files = (names: ReadonlyArray<string>): WasmPackFiles | null => {
	const main_js = names.find(
		(name) =>
			name.endsWith('.js') &&
			!name.includes('_bg') &&
			name !== 'index.js' &&
			name !== 'browser.js' &&
			name !== 'stream.js'
	);
	if (!main_js) return null;
	const base = main_js.replace(/\.js$/, '');
	const is_small = base.includes('small');
	return {
		main_js,
		dts_file: `${base}.d.ts`,
		wasm_file: `${base}_bg.wasm`,
		pkg_name: is_small ? '@fuzdev/blake3-wasm-small' : '@fuzdev/blake3-wasm',
		is_small
	};
};

/** TypeScript syntax that must not survive `strip_stream_types`. */
const TS_PATTERNS: ReadonlyArray<RegExp> = [
	/: Blake3Hasher/,
	/: ReadableStream/,
	/: Promise</,
	/: StreamFunctions/,
	/: Uint8Array/,
	/\w\?\s*:/,
	/\w!\./,
	/import type /,
	/export interface /
];

/**
 * Strips `stream.ts`'s TypeScript syntax with targeted transforms. The file is small and stable,
 * so explicit replacements are preferable to a general-purpose TS stripper.
 * @throws `TaskError` - if any TypeScript syntax remains, naming the pattern
 */
export const strip_stream_types = (stream_ts: string): string => {
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
	for (const pattern of TS_PATTERNS) {
		if (pattern.test(stream_js)) {
			throw new TaskError(
				`stream.js still contains TypeScript syntax: ${pattern}\n` +
					'Update the type-stripping transforms in scripts/lib/npm_package.ts'
			);
		}
	}
	return stream_js;
};

/**
 * The Node entry: WASM is initialized synchronously at import time, so it needs no init guard.
 */
export const render_index_js = ({
	main_js,
	wasm_file
}: WasmPackFiles): string => `import { readFileSync } from 'node:fs';
import {
	default as init,
	initSync,
	Blake3Hasher,
	derive_key,
	hash,
	keyed_hash,
} from './${main_js}';
import { make_stream_functions } from './stream.js';

const wasm = readFileSync(new URL('./${wasm_file}', import.meta.url));
initSync({ module: wasm });

export { init, initSync as init_sync, Blake3Hasher, derive_key, hash, keyed_hash };
export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(Blake3Hasher);
`;

/**
 * The browser and default entry, re-exporting `init()` for async initialization.
 * Vite and other bundlers pick it via the `default` export condition and handle the
 * `new URL('./blake3_wasm_bg.wasm', import.meta.url)` pattern in the glue natively.
 * Every export is guarded with `_check()`, so use before `init()` fails clearly.
 */
export const render_browser_js = ({ main_js, pkg_name }: WasmPackFiles): string => `import {
	default as _init,
	initSync,
	Blake3Hasher as _Blake3Hasher,
	derive_key as _derive_key,
	hash as _hash,
	keyed_hash as _keyed_hash,
} from './${main_js}';
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

/**
 * The declarations for both entries. The core API re-exports wasm-bindgen's types, while
 * `init` and `init_sync` get clean signatures that don't leak wasm-bindgen's internals
 * (`InitOutput` with raw WASM function pointers).
 */
export const render_index_dts = ({ dts_file }: WasmPackFiles): string => `export {
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

/**
 * Patches wasm-pack's `package.json` in place with the npm name, metadata, and exports map.
 * @mutates pkg - replaces wasm-pack's `name`, `files`, `sideEffects`, and adds the npm metadata;
 * deletes `main`, `types`, and `module`, superseded by `exports`
 */
export const patch_package_json = (
	pkg: Record<string, unknown>,
	{ main_js, dts_file, wasm_file, pkg_name, is_small }: WasmPackFiles
): void => {
	pkg.name = pkg_name;
	pkg.description = 'BLAKE3 hashing compiled to WASM';
	pkg.type = 'module';
	pkg.exports = {
		'./package.json': './package.json',
		'.': {
			types: './index.d.ts',
			node: './index.js',
			default: './browser.js'
		}
	};
	pkg.files = [
		'index.js',
		'index.d.ts',
		'browser.js',
		'stream.js',
		main_js,
		dts_file,
		wasm_file,
		'README.md',
		'LICENSE'
	];
	pkg.keywords = [
		'blake3',
		'hash',
		'wasm',
		'webassembly',
		...(is_small ? ['size-optimized'] : ['simd']),
		'streaming',
		'keyed-hash',
		'key-derivation'
	];
	pkg.homepage = 'https://github.com/fuzdev/blake3';
	pkg.author = {
		name: 'Ryan Atkinson',
		email: 'mail@ryanatkn.com',
		url: 'https://www.ryanatkn.com/'
	};
	pkg.repository = {
		type: 'git',
		url: 'git+https://github.com/fuzdev/blake3.git'
	};
	pkg.bugs = 'https://github.com/fuzdev/blake3/issues';
	pkg.funding = 'https://www.ryanatkn.com/funding';
	pkg.engines = { node: '>=20' };
	// wasm-pack emits `sideEffects: ["./snippets/*"]`, declaring index.js
	// side-effect-free — but its top-level readFileSync + initSync IS the side
	// effect. Without this, a tree-shaking bundler on the `node` condition may
	// bypass the re-export facade and skip initialization entirely.
	pkg.sideEffects = ['./index.js'];

	// Remove wasm-pack web target fields superseded by exports
	delete pkg.main;
	delete pkg.types;
	delete pkg.module;
};

/**
 * The npm README: the repo README up to its `## Architecture` section, the user-facing part,
 * since the build, development, and publish sections are irrelevant to consumers and their
 * relative links break on npmjs.com.
 * @throws `TaskError` - if the README has no `## Architecture` section to split at
 */
export const render_npm_readme = (
	readme: string,
	{ pkg_name, is_small }: WasmPackFiles
): string => {
	const architecture_idx = readme.indexOf('\n## Architecture');
	if (architecture_idx === -1) {
		throw new TaskError(
			'could not find a "## Architecture" section in README.md, the npm README\'s split point'
		);
	}

	let npm_body = readme.slice(0, architecture_idx).replace('# blake3\n', `# ${pkg_name}\n`);

	if (is_small) {
		// Replace import paths and WASM filenames so examples match the installed package
		npm_body = npm_body
			.replaceAll("from '@fuzdev/blake3-wasm'", "from '@fuzdev/blake3-wasm-small'")
			.replaceAll("from 'npm:@fuzdev/blake3-wasm'", "from 'npm:@fuzdev/blake3-wasm-small'")
			.replaceAll("exclude: ['@fuzdev/blake3-wasm']", "exclude: ['@fuzdev/blake3-wasm-small']")
			.replaceAll('blake3_wasm_bg.wasm', 'blake3_wasm_small_bg.wasm');
		// Remove bundler alias tip (not relevant when already using the small build)
		npm_body = npm_body.replace(
			/\nOnly import one[^\n]+\nTo swap builds[^\n]+\n\n```ts\n[\s\S]*?\n```\n/,
			''
		);
	}

	return (
		npm_body +
		`
## Benchmarks

Cross-runtime results (Deno, Node.js, Bun, Wasmtime) are available in the
[GitHub repository](https://github.com/fuzdev/blake3/blob/main/benches/results/report.md).

## License

[0BSD](https://github.com/fuzdev/blake3/blob/main/LICENSE)
`
	);
};

export interface PatchNpmPackageDeps {
	/** The wasm-pack output directory, patched in place. */
	pkg_dir: FsDir;
	/** The project, read for `NPM_PACKAGE_SOURCES`. */
	project: FsReadDir;
	log: (message: string) => void;
}

/**
 * Generates the package files into `pkg_dir` and patches its `package.json`.
 * Every input is read and checked before anything is written, so a failure leaves
 * `pkg_dir` as wasm-pack left it.
 * @throws `TaskError` - if `pkg_dir` holds no wasm-pack main JS file or no valid `package.json`,
 * or as `strip_stream_types` and `render_npm_readme` do
 */
export const patch_npm_package = async ({
	pkg_dir,
	project,
	log
}: PatchNpmPackageDeps): Promise<void> => {
	const names: Array<string> = [];
	for await (const entry of pkg_dir.list()) {
		if (entry.kind === 'file') names.push(entry.name);
	}
	const files = to_wasm_pack_files(names);
	if (!files) throw new TaskError(`no wasm-pack main JS file found in ${pkg_dir.path}`);

	const pkg_text = await pkg_dir.read_text_if_exists('package.json');
	if (pkg_text === null) throw new TaskError(`no package.json in ${pkg_dir.path}`);
	let pkg: unknown;
	try {
		pkg = JSON.parse(pkg_text);
	} catch (error) {
		throw new TaskError(`invalid package.json in ${pkg_dir.path}: ${error}`);
	}
	if (typeof pkg !== 'object' || pkg === null || Array.isArray(pkg)) {
		throw new TaskError(`package.json in ${pkg_dir.path} is not an object`);
	}
	patch_package_json(pkg as Record<string, unknown>, files);

	const stream_js = strip_stream_types(await project.read_text(NPM_PACKAGE_SOURCES.stream_ts));
	const readme = render_npm_readme(await project.read_text(NPM_PACKAGE_SOURCES.readme), files);
	const license = await project.read_text(NPM_PACKAGE_SOURCES.license);

	await pkg_dir.write('stream.js', stream_js);
	log(`Generated stream.js from ${NPM_PACKAGE_SOURCES.stream_ts}`);
	await pkg_dir.write('index.js', render_index_js(files));
	log('Created index.js');
	await pkg_dir.write('browser.js', render_browser_js(files));
	log('Created browser.js');
	await pkg_dir.write('index.d.ts', render_index_dts(files));
	log('Created index.d.ts');
	await pkg_dir.write('package.json', JSON.stringify(pkg, null, '\t') + '\n');
	log('Patched package.json');
	await pkg_dir.write('README.md', readme);
	log(`Generated npm README for ${files.pkg_name}`);
	await pkg_dir.write('LICENSE', license);
	log('Copied LICENSE');
};
