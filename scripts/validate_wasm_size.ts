/**
 * Validates WASM binary sizes against expected ranges and checks package structure.
 *
 * Catches binary size regressions from toolchain updates, dependency changes,
 * or build configuration drift. Only checks files that exist (skips unbuilt targets).
 *
 * Usage: deno task validate:size
 *
 * @module
 */

import process from 'node:process';
import { readdirSync, statSync } from 'node:fs';

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(msg: string): void {
	console.log(`  PASS: ${msg}`);
	passed++;
}

function fail(msg: string): void {
	console.log(`  FAIL: ${msg}`);
	failed++;
}

function skip(msg: string): void {
	console.log(`  SKIP: ${msg}`);
	skipped++;
}

function exists(path: string): boolean {
	try {
		statSync(path);
		return true;
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return false;
		throw error;
	}
}

function file_size(path: string): number {
	return statSync(path).size;
}

// --- WASM binary size checks ---

interface SizeCheck {
	label: string;
	glob_dir: string;
	suffix: string;
	min_bytes: number;
	max_bytes: number;
}

// Expected sizes with ±10 KB tolerance:
// blake3_wasm (SIMD): ~50 KB (current: 50,185 bytes)
// blake3_wasm_small (no SIMD): ~35 KB (current: 35,119 bytes)
const size_checks: SizeCheck[] = [
	{
		label: 'blake3_wasm deno',
		glob_dir: 'crates/blake3_wasm/pkg/deno',
		suffix: '_bg.wasm',
		min_bytes: 40_000,
		max_bytes: 60_000,
	},
	{
		label: 'blake3_wasm web',
		glob_dir: 'crates/blake3_wasm/pkg/web',
		suffix: '_bg.wasm',
		min_bytes: 40_000,
		max_bytes: 60_000,
	},
	{
		label: 'blake3_wasm_small deno',
		glob_dir: 'crates/blake3_wasm_small/pkg/deno',
		suffix: '_bg.wasm',
		min_bytes: 25_000,
		max_bytes: 45_000,
	},
	{
		label: 'blake3_wasm_small web',
		glob_dir: 'crates/blake3_wasm_small/pkg/web',
		suffix: '_bg.wasm',
		min_bytes: 25_000,
		max_bytes: 45_000,
	},
];

const root = new URL('..', import.meta.url).pathname;

console.log('=== WASM binary sizes ===');

for (const check of size_checks) {
	const dir_path = `${root}${check.glob_dir}`;
	if (!exists(dir_path)) {
		skip(`${check.label} — not built`);
		continue;
	}

	const entries = readdirSync(dir_path);
	const wasm_file = entries.find((f) => f.endsWith(check.suffix));
	if (!wasm_file) {
		fail(`${check.label} — no ${check.suffix} file found in ${check.glob_dir}`);
		continue;
	}

	const size = file_size(`${dir_path}/${wasm_file}`);
	const size_kb = (size / 1024).toFixed(1);

	const min_kb = (check.min_bytes / 1024).toFixed(1);
	const max_kb = (check.max_bytes / 1024).toFixed(1);

	if (size < check.min_bytes) {
		fail(`${check.label}: ${size_kb} KB (${size} bytes) < min ${min_kb} KB — suspiciously small`);
	} else if (size > check.max_bytes) {
		fail(`${check.label}: ${size_kb} KB (${size} bytes) > max ${max_kb} KB — size regression`);
	} else {
		pass(`${check.label}: ${size_kb} KB (${size} bytes)`);
	}
}

// --- SIMD vs small relative size check ---

const simd_deno = `${root}crates/blake3_wasm/pkg/deno`;
const small_deno = `${root}crates/blake3_wasm_small/pkg/deno`;

if (exists(simd_deno) && exists(small_deno)) {
	console.log();
	console.log('=== Relative size check ===');

	const simd_entries = readdirSync(simd_deno);
	const small_entries = readdirSync(small_deno);
	const simd_wasm = simd_entries.find((f) => f.endsWith('_bg.wasm'));
	const small_wasm = small_entries.find((f) => f.endsWith('_bg.wasm'));

	if (simd_wasm && small_wasm) {
		const simd_size = file_size(`${simd_deno}/${simd_wasm}`);
		const small_size = file_size(`${small_deno}/${small_wasm}`);
		const diff = simd_size - small_size;
		const diff_kb = (diff / 1024).toFixed(1);

		// SIMD build should be 10-25 KB larger than small build
		if (diff < 10_000) {
			fail(`SIMD - small = ${diff_kb} KB — expected ≥10 KB difference (SIMD code missing?)`);
		} else if (diff > 25_000) {
			fail(`SIMD - small = ${diff_kb} KB — expected ≤25 KB difference (unexpected bloat)`);
		} else {
			pass(`SIMD - small = ${diff_kb} KB (${diff} bytes)`);
		}
	}
}

// --- Package structure checks (web builds only) ---

const web_builds = [
	{ label: 'blake3_wasm', dir: 'crates/blake3_wasm/pkg/web' },
	{ label: 'blake3_wasm_small', dir: 'crates/blake3_wasm_small/pkg/web' },
];

const required_files = [
	'index.js',
	'browser.js',
	'stream.js',
	'index.d.ts',
	'package.json',
	'README.md',
	'LICENSE',
];

for (const build of web_builds) {
	const dir_path = `${root}${build.dir}`;
	console.log();
	console.log(`=== ${build.label} package structure ===`);
	if (!exists(dir_path)) {
		skip(`${build.label} — not built`);
		continue;
	}

	for (const file of required_files) {
		if (exists(`${dir_path}/${file}`)) {
			pass(file);
		} else {
			fail(`${file} — missing from ${build.dir}`);
		}
	}

	// Check for at least one .wasm file
	const entries = readdirSync(dir_path);
	const has_wasm = entries.some((f) => f.endsWith('.wasm'));
	if (has_wasm) {
		pass('.wasm file present');
	} else {
		fail('.wasm file — missing');
	}
}

// --- Summary ---

console.log();
console.log(`=== Size validation: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);
if (failed > 0) {
	process.exit(1);
}
