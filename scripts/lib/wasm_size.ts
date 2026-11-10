/**
 * Checks the built WASM packages: binary sizes against expected ranges, the SIMD build's
 * size relative to the small one, and the files the npm package needs.
 *
 * Catches binary size regressions from toolchain updates, dependency changes, or build
 * configuration drift. A package that isn't built fails its checks: the gate vouches for
 * built output, so nothing built is nothing vouched for.
 *
 * @module
 */

import type { FsReadDir } from '@fuzdev/gro/fs.ts';

/** A built package and the size range its binary must fall in. */
export interface WasmSizeCheck {
	label: string;
	/** The wasm-pack output directory, relative to the project. */
	dir: string;
	min_bytes: number;
	max_bytes: number;
}

// expected sizes with roughly ±10 KB of tolerance: the SIMD build is ~45 KB, the small build ~32 KB
export const WASM_SIZE_CHECKS: ReadonlyArray<WasmSizeCheck> = [
	{ label: 'blake3_wasm', dir: 'crates/blake3_wasm/pkg', min_bytes: 40_000, max_bytes: 60_000 },
	{
		label: 'blake3_wasm_small',
		dir: 'crates/blake3_wasm_small/pkg',
		min_bytes: 25_000,
		max_bytes: 45_000
	}
];

/** How much larger the SIMD build must be than the small one: its SIMD code. */
export const SIMD_SIZE_DIFFERENCE = { min_bytes: 10_000, max_bytes: 25_000 } as const;

/** The files `scripts/lib/npm_package.ts` and wasm-pack must leave in each package. */
export const PACKAGE_REQUIRED_FILES: ReadonlyArray<string> = [
	'index.js',
	'browser.js',
	'stream.js',
	'index.d.ts',
	'package.json',
	'README.md',
	'LICENSE'
];

export interface WasmSizeReport {
	/** The report's lines, in order. */
	lines: Array<string>;
	passed: number;
	failed: number;
}

const BUILD_HINT = 'run npm run build:wasm';

/**
 * Runs every check against the packages under `project`.
 * @param project - the project directory, read only
 */
export const validate_wasm_size = async (project: FsReadDir): Promise<WasmSizeReport> => {
	const report: WasmSizeReport = { lines: [], passed: 0, failed: 0 };
	const pass = (message: string): void => {
		report.lines.push(`  PASS: ${message}`);
		report.passed++;
	};
	const fail = (message: string): void => {
		report.lines.push(`  FAIL: ${message}`);
		report.failed++;
	};

	// each built package's file names, `null` when it isn't built
	const listings = new Map<string, Array<string> | null>();
	for (const { dir } of WASM_SIZE_CHECKS) {
		const info = await project.stat(dir);
		if (info?.kind !== 'directory') {
			listings.set(dir, null);
			continue;
		}
		const names: Array<string> = [];
		for await (const entry of project.list(dir)) names.push(entry.name);
		listings.set(dir, names);
	}

	const wasm_bytes = new Map<string, number>();

	report.lines.push('=== WASM binary sizes ===');
	for (const check of WASM_SIZE_CHECKS) {
		const names = listings.get(check.dir);
		if (!names) {
			fail(`${check.label} — not built (${BUILD_HINT})`);
			continue;
		}
		const wasm_file = names.find((name) => name.endsWith('_bg.wasm'));
		if (!wasm_file) {
			fail(`${check.label} — no _bg.wasm file found in ${check.dir}`);
			continue;
		}
		const info = await project.stat(`${check.dir}/${wasm_file}`);
		const size = info?.size ?? 0;
		wasm_bytes.set(check.label, size);
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

	const simd_size = wasm_bytes.get('blake3_wasm');
	const small_size = wasm_bytes.get('blake3_wasm_small');
	if (simd_size !== undefined && small_size !== undefined) {
		report.lines.push('', '=== Relative size check ===');
		const diff = simd_size - small_size;
		const diff_kb = (diff / 1024).toFixed(1);
		if (diff < SIMD_SIZE_DIFFERENCE.min_bytes) {
			fail(`SIMD - small = ${diff_kb} KB — expected ≥10 KB difference (SIMD code missing?)`);
		} else if (diff > SIMD_SIZE_DIFFERENCE.max_bytes) {
			fail(`SIMD - small = ${diff_kb} KB — expected ≤25 KB difference (unexpected bloat)`);
		} else {
			pass(`SIMD - small = ${diff_kb} KB (${diff} bytes)`);
		}
	}

	for (const check of WASM_SIZE_CHECKS) {
		report.lines.push('', `=== ${check.label} package structure ===`);
		const names = listings.get(check.dir);
		if (!names) {
			fail(`${check.label} — not built (${BUILD_HINT})`);
			continue;
		}
		for (const file of PACKAGE_REQUIRED_FILES) {
			if (names.includes(file)) {
				pass(file);
			} else {
				fail(`${file} — missing from ${check.dir}`);
			}
		}
		if (names.some((name) => name.endsWith('.wasm'))) {
			pass('.wasm file present');
		} else {
			fail('.wasm file — missing');
		}
	}

	report.lines.push(
		'',
		`=== Size validation: ${report.passed} passed, ${report.failed} failed ===`
	);
	return report;
};
