/**
 * Validates bench result JSON files against the BenchSuiteResult schema.
 *
 * Catches drift between the Rust structs (blake3_bench_wasmtime) and
 * the TS interfaces (benches/lib/bench_core.ts) by validating the shared
 * JSON output format.
 *
 * Only checks non-timestamped files (e.g. wasmtime.json, deno.json)
 * since those are the fixed-name outputs used by the report.
 *
 * Usage: deno task validate:bench
 */

import process from 'node:process';
import { readdirSync, readFileSync } from 'node:fs';

/** Required stats fields that are plain numbers (present in both TS and Rust output). */
const STATS_NUMBER_FIELDS = [
	'mean_ns',
	'ops_per_second',
	'std_dev_ns',
	'sample_size',
	'p50_ns',
	'p75_ns',
	'p90_ns',
	'p95_ns',
	'p99_ns',
	'min_ns',
	'max_ns',
] as const;

/** Optional stats fields (fuz_util Benchmark outputs these, Wasmtime doesn't). */
const OPTIONAL_STATS_FIELDS = [
	'cv',
	'outliers_ns',
	'outlier_ratio',
	'raw_sample_size',
	'failed_iterations',
] as const;

const results_dir = new URL('../benches/results/', import.meta.url);

let entries: string[];
try {
	entries = readdirSync(results_dir, { encoding: 'utf-8' });
} catch {
	console.log('No benches/results/ directory found — nothing to validate.');
	process.exit(0);
}

// Non-timestamped JSON files: no leading digit (timestamps start with 20xx-)
const files = entries.filter((f) => f.endsWith('.json') && !/^\d/.test(f));

if (files.length === 0) {
	console.log('No non-timestamped result files found — nothing to validate.');
	process.exit(0);
}

let passed = 0;
let failed = 0;

function fail(file: string, path: string, msg: string): void {
	console.log(`  FAIL: ${file} — ${path}: ${msg}`);
	failed++;
}

function is_record(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

for (const file of files) {
	const file_path = new URL(file, results_dir);
	let data: unknown;
	try {
		data = JSON.parse(readFileSync(file_path, 'utf-8'));
	} catch (e) {
		fail(file, '(root)', `invalid JSON: ${e}`);
		continue;
	}

	if (!is_record(data)) {
		fail(file, '(root)', 'expected object');
		continue;
	}

	let file_ok = true;

	// Top-level fields
	if (typeof data.runtime !== 'string') {
		fail(file, 'runtime', `expected string, got ${typeof data.runtime}`);
		file_ok = false;
	}
	if (typeof data.timestamp !== 'string') {
		fail(file, 'timestamp', `expected string, got ${typeof data.timestamp}`);
		file_ok = false;
	}

	// Groups
	if (!Array.isArray(data.groups)) {
		fail(file, 'groups', `expected array, got ${typeof data.groups}`);
		file_ok = false;
	} else {
		for (let gi = 0; gi < data.groups.length; gi++) {
			const group: unknown = data.groups[gi];
			const gp = `groups[${gi}]`;

			if (!is_record(group)) {
				fail(file, gp, 'expected object');
				file_ok = false;
				continue;
			}
			if (typeof group.name !== 'string') {
				fail(file, `${gp}.name`, `expected string, got ${typeof group.name}`);
				file_ok = false;
			}
			if (group.data_bytes !== undefined && typeof group.data_bytes !== 'number') {
				fail(file, `${gp}.data_bytes`, `expected number, got ${typeof group.data_bytes}`);
				file_ok = false;
			}
			if (!Array.isArray(group.results)) {
				fail(file, `${gp}.results`, `expected array, got ${typeof group.results}`);
				file_ok = false;
				continue;
			}

			for (let ri = 0; ri < group.results.length; ri++) {
				const result: unknown = group.results[ri];
				const rp = `${gp}.results[${ri}]`;

				if (!is_record(result)) {
					fail(file, rp, 'expected object');
					file_ok = false;
					continue;
				}
				if (typeof result.name !== 'string') {
					fail(file, `${rp}.name`, `expected string, got ${typeof result.name}`);
					file_ok = false;
				}
				if (
					result.category !== undefined &&
					result.category !== 'blake3' &&
					result.category !== 'reference' &&
					result.category !== 'baseline'
				) {
					fail(
						file,
						`${rp}.category`,
						`expected 'blake3'|'reference'|'baseline', got '${result.category}'`,
					);
					file_ok = false;
				}
				if (!is_record(result.stats)) {
					fail(file, `${rp}.stats`, `expected object, got ${typeof result.stats}`);
					file_ok = false;
					continue;
				}

				for (const field of STATS_NUMBER_FIELDS) {
					if (typeof result.stats[field] !== 'number') {
						fail(
							file,
							`${rp}.stats.${field}`,
							`expected number, got ${typeof result.stats[field]}`,
						);
						file_ok = false;
					}
				}

				// confidence_interval_ns is a [number, number] tuple
				const ci = result.stats.confidence_interval_ns;
				if (
					!Array.isArray(ci) ||
					ci.length !== 2 ||
					typeof ci[0] !== 'number' ||
					typeof ci[1] !== 'number'
				) {
					fail(
						file,
						`${rp}.stats.confidence_interval_ns`,
						`expected [number, number], got ${JSON.stringify(ci)}`,
					);
					file_ok = false;
				}

				// Check for unexpected stats fields
				const known_stats: readonly string[] = [
					...STATS_NUMBER_FIELDS,
					'confidence_interval_ns',
					...OPTIONAL_STATS_FIELDS,
				];
				const extra = Object.keys(result.stats).filter(
					(k) => !known_stats.includes(k),
				);
				if (extra.length > 0) {
					fail(file, `${rp}.stats`, `unexpected fields: ${extra.join(', ')}`);
					file_ok = false;
				}
			}
		}
	}

	// WASM sizes
	if (!Array.isArray(data.wasm_sizes)) {
		fail(file, 'wasm_sizes', `expected array, got ${typeof data.wasm_sizes}`);
		file_ok = false;
	} else {
		for (let i = 0; i < data.wasm_sizes.length; i++) {
			const ws: unknown = data.wasm_sizes[i];
			const wp = `wasm_sizes[${i}]`;

			if (!is_record(ws)) {
				fail(file, wp, 'expected object');
				file_ok = false;
				continue;
			}
			if (typeof ws.label !== 'string') {
				fail(file, `${wp}.label`, `expected string, got ${typeof ws.label}`);
				file_ok = false;
			}
			if (typeof ws.bytes !== 'number') {
				fail(file, `${wp}.bytes`, `expected number, got ${typeof ws.bytes}`);
				file_ok = false;
			}
		}
	}

	// runner_categories (optional)
	if (data.runner_categories !== undefined) {
		if (!is_record(data.runner_categories)) {
			fail(
				file,
				'runner_categories',
				`expected object, got ${typeof data.runner_categories}`,
			);
			file_ok = false;
		} else {
			for (const [key, val] of Object.entries(data.runner_categories)) {
				if (typeof val !== 'string') {
					fail(
						file,
						`runner_categories.${key}`,
						`expected string, got ${typeof val}`,
					);
					file_ok = false;
				}
			}
		}
	}

	// Check for unexpected top-level fields
	const expected_top = ['runtime', 'timestamp', 'groups', 'wasm_sizes', 'runner_categories'];
	const extra_top = Object.keys(data).filter((k) => !expected_top.includes(k));
	if (extra_top.length > 0) {
		fail(file, '(root)', `unexpected fields: ${extra_top.join(', ')}`);
		file_ok = false;
	}

	if (file_ok) {
		console.log(`  PASS: ${file}`);
		passed++;
	}
}

console.log();
console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
	process.exit(1);
}
