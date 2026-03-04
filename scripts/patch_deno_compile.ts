/**
 * Patches wasm-bindgen deno target output for `deno compile` compatibility.
 *
 * TODO: revisit this — it's a workaround for `deno compile` not supporting
 * `fetch()` for embedded WASM files and treating `--include`d `.wasm` files
 * as modules (triggering import resolution on the WASM's `_bg.js` import).
 * If Deno adds native support for wasm-bindgen's `fetch(new URL(..., import.meta.url))`
 * pattern in compiled binaries, this script can be removed.
 *
 * wasm-bindgen's deno target uses `fetch()` to load WASM, which is incompatible
 * with `deno compile` (embedded files are only accessible via `Deno.readFile*`).
 *
 * This script:
 * 1. Replaces `fetch()` + `WebAssembly.instantiateStreaming` with
 *    `Deno.readFileSync` + `WebAssembly.instantiate`
 * 2. Creates a `_bg.js` stub to satisfy the WASM module's import resolution
 *    during `deno compile` (the stub is never called at runtime — the WASM is
 *    manually instantiated with real imports from `__wbg_get_imports()`)
 *
 * Usage: deno run --allow-read --allow-write scripts/patch_deno_compile.ts <pkg-dir>
 *
 * @module
 */

const dir = Deno.args[0];
if (!dir) {
	console.error('Usage: patch_deno_compile.ts <pkg-dir>');
	Deno.exit(1);
}

// Find the main JS file that has the fetch() pattern to patch.
// Uses pattern matching instead of filename heuristics to handle stale files from renames.
const fetch_re =
	/const wasmUrl = new URL\('([^']+)', import\.meta\.url\);\nconst wasmInstantiated = await WebAssembly\.instantiateStreaming\(fetch\(wasmUrl\), __wbg_get_imports\(\)\);/;

const entries = [...Deno.readDirSync(dir)];
const js_candidates = entries.filter(
	(e) => e.isFile && e.name.endsWith('.js') && !e.name.includes('_bg'),
);

let js_path: string | undefined;
let js: string | undefined;
let fetch_match: RegExpMatchArray | null = null;

for (const entry of js_candidates) {
	const path = `${dir}/${entry.name}`;
	const content = Deno.readTextFileSync(path);
	const match = content.match(fetch_re);
	if (match) {
		js_path = path;
		js = content;
		fetch_match = match;
		break;
	}
}

if (!js_path || !js || !fetch_match) {
	console.error(`No unpatched JS file found in ${dir} — already patched?`);
	Deno.exit(1);
}

const wasm_filename = fetch_match[1];
js = js.replace(
	fetch_re,
	`const wasmBytes = Deno.readFileSync(new URL('${wasm_filename}', import.meta.url));\n` +
		`const wasmInstantiated = await WebAssembly.instantiate(wasmBytes, __wbg_get_imports());`,
);

Deno.writeTextFileSync(js_path, js);
console.log(`Patched WASM loading in ${js_path}`);

// 2. Create _bg.js stub for deno compile module resolution
//    Extract the bg module name and its import function names from __wbg_get_imports()
const imports_re = /function __wbg_get_imports\(\)\s*\{([\s\S]*?)\n\}/;
const imports_match = js.match(imports_re);
if (!imports_match) {
	console.error(`__wbg_get_imports() not found in ${js_path}`);
	Deno.exit(1);
}

const imports_body = imports_match[1];

// Find the bg module name: "./blake3_wasm_bg.js" or "./blake3_wasm_small_bg.js"
const bg_module_re = /"\.\/([\w]+_bg\.js)"/;
const bg_match = imports_body.match(bg_module_re);
if (!bg_match) {
	console.error(`_bg.js module reference not found in __wbg_get_imports()`);
	Deno.exit(1);
}
const bg_filename = bg_match[1];

// Extract function names from the import object
const fn_names: Array<string> = [];
const fn_re = /\b(__\w+):\s*function\s*\(/g;
let fn_match;
while ((fn_match = fn_re.exec(imports_body)) !== null) {
	fn_names.push(fn_match[1]);
}

if (fn_names.length === 0) {
	console.error(`No import functions found in __wbg_get_imports()`);
	Deno.exit(1);
}

const stub_lines = [
	'// Stub for deno compile module resolution.',
	'// The WASM binary imports from this module, but at runtime the WASM is',
	'// manually instantiated via WebAssembly.instantiate() with real imports',
	'// from __wbg_get_imports(). These exports satisfy compile-time resolution only.',
	...fn_names.map((name) => `export function ${name}() {}`),
	'',
];

const bg_path = `${dir}/${bg_filename}`;
Deno.writeTextFileSync(bg_path, stub_lines.join('\n'));
console.log(`Created stub ${bg_path} (${fn_names.length} exports)`);
