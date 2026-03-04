/**
 * Smoke test for `deno compile` compatibility with the patched WASM loading.
 *
 * The deno build patches wasm-bindgen's `fetch()` to `Deno.readFileSync()` for
 * `deno compile` support. This script verifies the full pipeline for both
 * blake3_wasm and blake3_wasm_small: compile a minimal script that imports the
 * package, run the compiled binary, and check it produces the correct hash.
 *
 * Usage: deno task validate:compile
 *
 * Prerequisites: deno task build:wasm
 *
 * @module
 */

const EXPECTED_HEX = 'ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f';

const root = new URL('..', import.meta.url).pathname;

const targets = [
	{ label: 'blake3_wasm', pkg_dir: `${root}crates/blake3_wasm/pkg/deno` },
	{ label: 'blake3_wasm_small', pkg_dir: `${root}crates/blake3_wasm_small/pkg/deno` },
];

let all_ok = true;

for (const { label, pkg_dir } of targets) {
	const ok = test_compile(label, pkg_dir);
	if (!ok) all_ok = false;
}

if (!all_ok) {
	Deno.exit(1);
}

function test_compile(label: string, pkg_dir: string): boolean {
	const tmp_script = `/tmp/blake3_compile_test_${label}.ts`;
	const tmp_binary = `/tmp/blake3_compile_test_${label}`;

	// Check prerequisite
	try {
		Deno.statSync(pkg_dir);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) throw error;
		console.log(`SKIP: ${label} deno build not found — run deno task build:wasm first`);
		return true;
	}

	// Find the main JS file in pkg/deno/ (e.g. blake3_wasm.js)
	const pkg_entries = [...Deno.readDirSync(pkg_dir)];
	const main_js = pkg_entries.find(
		(e) => e.isFile && e.name.endsWith('.js') && !e.name.includes('_bg'),
	);
	if (!main_js) {
		console.log(`FAIL: no main JS file found in ${pkg_dir}`);
		return false;
	}

	// Import directly from the generated JS (not mod.ts) to test the patched WASM loading
	const js_path = `${pkg_dir}/${main_js.name}`;

	// 1. Write test script
	const script = `\
import { hash } from '${js_path}';
const result = Array.from(hash(new TextEncoder().encode('hello')), b => b.toString(16).padStart(2, '0')).join('');
if (result !== '${EXPECTED_HEX}') {
	console.error('FAIL: expected ${EXPECTED_HEX}');
	console.error('  got ' + result);
	Deno.exit(1);
}
console.log('PASS: hash("hello") = ' + result);
`;

	Deno.writeTextFileSync(tmp_script, script);

	let ok = true;

	try {
		// 2. Compile
		console.log(`=== deno compile: ${label} ===`);
		console.log(`  Compiling ${tmp_script}...`);

		const compile = new Deno.Command('deno', {
			args: [
				'compile',
				'--allow-read',
				`--include=${pkg_dir}`,
				'--output',
				tmp_binary,
				tmp_script,
			],
			stdout: 'piped',
			stderr: 'piped',
		});

		const compile_result = compile.outputSync();
		if (!compile_result.success) {
			const stderr = new TextDecoder().decode(compile_result.stderr);
			console.log(`  FAIL: deno compile exited ${compile_result.code}`);
			console.log(stderr);
			ok = false;
		} else {
			console.log('  Compiled successfully');

			// 3. Run compiled binary
			console.log(`  Running ${tmp_binary}...`);

			const run = new Deno.Command(tmp_binary, {
				stdout: 'piped',
				stderr: 'piped',
			});

			const run_result = run.outputSync();
			const stdout = new TextDecoder().decode(run_result.stdout).trim();
			const stderr = new TextDecoder().decode(run_result.stderr).trim();

			if (!run_result.success) {
				console.log(`  FAIL: compiled binary exited ${run_result.code}`);
				if (stderr) console.log(`  ${stderr}`);
				ok = false;
			} else {
				console.log(`  ${stdout}`);
			}
		}
	} finally {
		// 4. Cleanup
		try {
			Deno.removeSync(tmp_script);
		} catch {
			// ignore
		}
		try {
			Deno.removeSync(tmp_binary);
		} catch {
			// ignore
		}
	}

	console.log();
	if (ok) {
		console.log(`=== deno compile ${label}: PASS ===\n`);
	} else {
		console.log(`=== deno compile ${label}: FAIL ===\n`);
	}
	return ok;
}
