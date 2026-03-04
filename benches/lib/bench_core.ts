/**
 * Shared benchmark core — N runners, hash, optional streaming.
 *
 * No Deno.* or bare process.* references. Each runtime entry point loads
 * WASM modules and passes them as BenchRunner instances.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Benchmark } from '@fuzdev/fuz_util/benchmark.js';
import { benchmark_format_markdown } from '@fuzdev/fuz_util/benchmark_format.js';
import type { BenchmarkResult } from '@fuzdev/fuz_util/benchmark_types.js';
import { time_format, time_unit_detect_best } from '@fuzdev/fuz_util/time.js';

import { st } from './color.ts';

export interface HasherInstance {
	update(data: Uint8Array): void;
	finalize(): Uint8Array;
	free(): void;
}

export interface HasherModule {
	create(): HasherInstance;
}

export interface WasmFileInfo {
	label: string;
	path: string;
}

/** Structural type for a Blake3Hasher constructor — works with both mod.ts and wasm-bindgen output. */
export interface Blake3HasherLike {
	new (): { update(data: Uint8Array): void; finalize(): Uint8Array; free(): void };
}

/** Adapt a Blake3Hasher constructor to the HasherModule interface. */
export const make_hasher = (Hasher: Blake3HasherLike): HasherModule => ({
	create() {
		const h = new Hasher();
		return {
			update: (data: Uint8Array) => h.update(data),
			finalize: () => h.finalize(),
			free: () => h.free(),
		};
	},
});

/** A blake3 optimization profile to benchmark. */
export interface Blake3Profile {
	label: string;
	hash: (data: Uint8Array) => Uint8Array;
	keyed_hash: (key: Uint8Array, data: Uint8Array) => Uint8Array;
	derive_key: (context: string, key_material: Uint8Array) => Uint8Array;
	Blake3Hasher: Blake3HasherLike;
	wasm_path: string;
	hash_stream?: (stream: ReadableStream<Uint8Array>) => Promise<Uint8Array>;
	keyed_hash_stream?: (
		key: Uint8Array,
		stream: ReadableStream<Uint8Array>,
	) => Promise<Uint8Array>;
	derive_key_stream?: (
		context: string,
		stream: ReadableStream<Uint8Array>,
	) => Promise<Uint8Array>;
}

/** Shape of the npm:blake3-wasm module (works with both browser-async and CJS imports). */
export interface NpmBlake3Like {
	hash(data: Uint8Array): Uint8Array;
	keyedHash(key: Uint8Array, data: Uint8Array): Uint8Array;
	deriveKey(context: string, data: Uint8Array): Uint8Array;
	createHash(): {
		update(data: Uint8Array): void;
		digest(): Uint8Array;
		dispose(): void;
	};
}

/** Build the standard runner array from blake3 profiles and the npm reference. */
export const make_runners = (
	profiles: Blake3Profile[],
	npm: { module: NpmBlake3Like; wasm_path: string },
): BenchRunner[] => [
	...profiles.map((p) => ({
		label: p.label,
		hash: p.hash,
		keyed_hash: p.keyed_hash,
		derive_key: p.derive_key,
		Hasher: make_hasher(p.Blake3Hasher),
		hash_stream: p.hash_stream,
		keyed_hash_stream: p.keyed_hash_stream,
		derive_key_stream: p.derive_key_stream,
		wasm_file: { label: p.label, path: p.wasm_path },
		verify_group: 'blake3',
		category: 'blake3' as const,
	})),
	{
		label: 'npm:blake3-wasm',
		hash: (data: Uint8Array) => npm.module.hash(data),
		keyed_hash: (key: Uint8Array, data: Uint8Array) => npm.module.keyedHash(key, data),
		derive_key: (context: string, key_material: Uint8Array) =>
			npm.module.deriveKey(context, key_material),
		Hasher: {
			create() {
				const h = npm.module.createHash();
				return {
					update: (data: Uint8Array) => h.update(data),
					finalize: () => h.digest(),
					free: () => h.dispose(),
				};
			},
		},
		wasm_file: { label: 'npm:blake3-wasm', path: npm.wasm_path },
		verify_group: 'blake3',
		category: 'reference' as const,
	},
];

/** A single hash implementation to benchmark. */
export interface BenchRunner {
	label: string;
	hash: (data: Uint8Array) => Uint8Array;
	keyed_hash?: (key: Uint8Array, data: Uint8Array) => Uint8Array;
	derive_key?: (context: string, key_material: Uint8Array) => Uint8Array;
	Hasher?: HasherModule;
	hash_stream?: (stream: ReadableStream<Uint8Array>) => Promise<Uint8Array>;
	keyed_hash_stream?: (
		key: Uint8Array,
		stream: ReadableStream<Uint8Array>,
	) => Promise<Uint8Array>;
	derive_key_stream?: (
		context: string,
		stream: ReadableStream<Uint8Array>,
	) => Promise<Uint8Array>;
	wasm_file?: WasmFileInfo;
	/** Runners in the same group are verified to produce identical output. */
	verify_group?: string;
	/** Runner category for structured report generation. */
	category?: 'blake3' | 'reference';
}

export interface BenchConfig {
	duration_ms: number;
	warmup_iterations: number;
	runners: BenchRunner[];
	runtime_label: string;
	/** Path to write JSON results. If omitted, no JSON is written. */
	output_json?: string;
	/** If true, call globalThis.gc() between benchmark groups (requires --expose-gc). */
	gc_between_groups?: boolean;
}

export interface BenchGroupResult {
	name: string;
	data_bytes?: number;
	results: Array<{
		name: string;
		category?: 'blake3' | 'reference';
		stats: {
			mean_ns: number;
			ops_per_second: number;
			std_dev_ns: number;
			sample_size: number;
			confidence_interval_ns: [number, number];
			p50_ns: number;
			p75_ns: number;
			p90_ns: number;
			p95_ns: number;
			p99_ns: number;
			min_ns: number;
			max_ns: number;
		};
	}>;
}

export interface BenchSuiteResult {
	runtime: string;
	timestamp: string;
	groups: BenchGroupResult[];
	wasm_sizes: Array<{ label: string; bytes: number }>;
	runner_categories?: Record<string, string>;
}

/** Map Benchmark results to the serializable BenchGroupResult format. */
function map_bench_results(
	results: BenchmarkResult[],
	categories: Map<string, BenchRunner['category']>,
): BenchGroupResult['results'] {
	return results.map((r) => ({
		name: r.name,
		category: categories.get(r.name),
		stats: {
			mean_ns: r.stats.mean_ns,
			ops_per_second: r.stats.ops_per_second,
			std_dev_ns: r.stats.std_dev_ns,
			sample_size: r.stats.sample_size,
			confidence_interval_ns: r.stats.confidence_interval_ns,
			p50_ns: r.stats.p50_ns,
			p75_ns: r.stats.p75_ns,
			p90_ns: r.stats.p90_ns,
			p95_ns: r.stats.p95_ns,
			p99_ns: r.stats.p99_ns,
			min_ns: r.stats.min_ns,
			max_ns: r.stats.max_ns,
		},
	}));
}

function to_hex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b: number) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Format throughput as MB/s (with comma separators) or KB/s. */
export function format_throughput(ops_per_second: number, data_bytes: number): string {
	const mb_s = (ops_per_second * data_bytes) / 1_000_000;
	if (mb_s >= 1) return `${format_comma(Math.round(mb_s))} MB/s`;
	return `${(mb_s * 1000).toFixed(1)} KB/s`;
}

/** Format a number with comma thousands separators. */
function format_comma(n: number): string {
	return Math.round(n)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Benchmark section for grouping in the summary. */
export type BenchSection = 'one_shot' | 'streaming' | 'stream_fn' | 'component';

/** Section headers for the summary output. */
export const SECTION_HEADERS: Record<BenchSection, string> = {
	one_shot: 'One-shot functions',
	streaming: 'Streaming (manual hasher loop)',
	stream_fn: 'Stream convenience functions (ReadableStream)',
	component: 'Component model',
};

/** Determine which section a benchmark group belongs to. */
export function get_bench_section(group_name: string): BenchSection {
	if (group_name.startsWith('streaming')) return 'streaming';
	if (group_name.includes('_stream')) return 'stream_fn';
	// keyed_hash / derive_key without _bytes suffix are component model-only groups
	if (/^(keyed_hash|derive_key) /.test(group_name)) return 'component';
	return 'one_shot';
}

/** Build an array of chunks from a buffer subarray. */
function make_chunks(buf: Uint8Array, bytes: number, chunk_size: number): Uint8Array[] {
	const data = buf.subarray(0, bytes);
	const chunks: Uint8Array[] = [];
	for (let i = 0; i < data.length; i += chunk_size) {
		chunks.push(data.subarray(i, i + chunk_size));
	}
	return chunks;
}

/** Get the short git commit hash, or empty string if not in a repo. */
export function get_git_commit_short(): string {
	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
	} catch {
		return '';
	}
}

function get_file_size(path: string): number {
	try {
		return statSync(path).size;
	} catch {
		console.warn(`Warning: WASM file not found: ${path}`);
		return 0;
	}
}

export async function run_benchmarks(config: BenchConfig): Promise<BenchSuiteResult> {
	const { duration_ms, warmup_iterations, runners, runtime_label, output_json } = config;

	// GC between benchmark groups to prevent GC pauses from landing inside measurements
	const gc = config.gc_between_groups && typeof globalThis.gc === 'function'
		? globalThis.gc
		: undefined;

	console.log(st('bold', `BLAKE3 WASM Benchmark — ${runtime_label}`));
	if (gc) console.log(st('dim', '(GC enabled between groups)'));
	console.log();

	// Build category lookup from runners
	const runner_categories = new Map<string, BenchRunner['category']>();
	for (const runner of runners) {
		if (runner.category) runner_categories.set(runner.label, runner.category);
	}

	// Verify correctness within each verify_group
	const verify_groups = new Map<string, BenchRunner[]>();
	for (const runner of runners) {
		if (runner.verify_group) {
			const group = verify_groups.get(runner.verify_group) ?? [];
			group.push(runner);
			verify_groups.set(runner.verify_group, group);
		}
	}

	const verify_data = new Uint8Array(1024).fill(0xab);
	const verify_key = new Uint8Array(32).fill(0x01);
	const verify_context = 'blake3-bench verify';
	for (const [group_name, group_runners] of verify_groups) {
		if (group_runners.length < 2) continue;
		console.log(`Verifying ${group_name} correctness...`);

		// hash
		const ref_hash = to_hex(group_runners[0].hash(verify_data));
		for (let i = 1; i < group_runners.length; i++) {
			const actual = to_hex(group_runners[i].hash(verify_data));
			if (actual !== ref_hash) {
				throw new Error(
					`hash mismatch in ${group_name}: ${group_runners[0].label} vs ${group_runners[i].label}`,
				);
			}
		}

		// keyed_hash — only if all runners in the group support it
		const keyed_runners = group_runners.filter((r) => r.keyed_hash);
		if (keyed_runners.length >= 2) {
			const ref_keyed = to_hex(keyed_runners[0].keyed_hash!(verify_key, verify_data));
			for (let i = 1; i < keyed_runners.length; i++) {
				const actual = to_hex(keyed_runners[i].keyed_hash!(verify_key, verify_data));
				if (actual !== ref_keyed) {
					throw new Error(
						`keyed_hash mismatch in ${group_name}: ${keyed_runners[0].label} vs ${
							keyed_runners[i].label
						}`,
					);
				}
			}
		}

		// derive_key — only if all runners in the group support it
		const derive_runners = group_runners.filter((r) => r.derive_key);
		if (derive_runners.length >= 2) {
			const ref_derive = to_hex(derive_runners[0].derive_key!(verify_context, verify_data));
			for (let i = 1; i < derive_runners.length; i++) {
				const actual = to_hex(derive_runners[i].derive_key!(verify_context, verify_data));
				if (actual !== ref_derive) {
					throw new Error(
						`derive_key mismatch in ${group_name}: ${derive_runners[0].label} vs ${
							derive_runners[i].label
						}`,
					);
				}
			}
		}
	}
	if (verify_groups.size > 0) {
		console.log(
			st('green', 'All hash/keyed_hash/derive_key outputs match.') + '\n',
		);
	}

	// Benchmark data sizes
	const sizes: Array<{ label: string; data: Uint8Array }> = [
		{ label: '32 B', data: new Uint8Array(32).fill(0xab) },
		{ label: '1 KB', data: new Uint8Array(1024).fill(0xab) },
		{ label: '64 KB', data: new Uint8Array(65536).fill(0xab) },
		{ label: '1 MB', data: new Uint8Array(1048576).fill(0xab) },
	];

	const all_results: BenchGroupResult[] = [];
	const all_full_results: Array<{ name: string; results: BenchmarkResult[] }> = [];

	// Hash benchmarks at each size
	for (const { label, data } of sizes) {
		console.log(`--- hash (${label}) ---`);

		const bench = new Benchmark({
			duration_ms,
			warmup_iterations,
			min_iterations: 3,
		});

		for (const runner of runners) {
			bench.add(runner.label, () => runner.hash(data));
		}

		gc?.();
		const results = await bench.run();
		const group_name = `hash (${label})`;
		all_results.push({
			name: group_name,
			data_bytes: data.length,
			results: map_bench_results(results, runner_categories),
		});
		all_full_results.push({ name: group_name, results });

		console.log();
	}

	// Shared constants for keyed_hash, derive_key, and streaming benchmarks
	const bench_key = new Uint8Array(32).fill(0x01);
	const bench_context = 'blake3-wasm-bench 2024';

	// Keyed hash and derive key benchmarks
	const keyed_derive_defs: Array<{
		name: string;
		filter: (r: BenchRunner) => boolean;
		make_task: (r: BenchRunner, data: Uint8Array) => () => Uint8Array;
	}> = [
		{
			name: 'keyed_hash',
			filter: (r) => r.keyed_hash != null,
			make_task: (r, data) => () => r.keyed_hash!(bench_key, data),
		},
		{
			name: 'derive_key',
			filter: (r) => r.derive_key != null,
			make_task: (r, data) => () => r.derive_key!(bench_context, data),
		},
	];

	for (const { name, filter, make_task } of keyed_derive_defs) {
		const eligible = runners.filter(filter);
		if (eligible.length === 0) continue;

		for (const { label, data } of sizes) {
			console.log(`--- ${name} (${label}) ---`);

			const bench = new Benchmark({
				duration_ms,
				warmup_iterations,
				min_iterations: 3,
			});

			for (const runner of eligible) {
				bench.add(runner.label, make_task(runner, data));
			}

			gc?.();
			const results = await bench.run();
			const group_name = `${name} (${label})`;
			all_results.push({
				name: group_name,
				data_bytes: data.length,
				results: map_bench_results(results, runner_categories),
			});
			all_full_results.push({ name: group_name, results });

			console.log();
		}
	}

	// Shared constants for streaming benchmarks
	const streaming_sizes = [
		{ label: '1 KB', bytes: 1024, chunk_size: 64 },
		{ label: '64 KB', bytes: 65536, chunk_size: 8192 },
		{ label: '1 MB', bytes: 1048576, chunk_size: 8192 },
	];
	const streaming_buf = new Uint8Array(1048576).fill(0xab);

	// Streaming benchmarks — only runners with Hasher
	const streamable = runners.filter((r) => r.Hasher);
	if (streamable.length > 0) {
		for (const { label, bytes, chunk_size } of streaming_sizes) {
			console.log(
				`--- streaming (${label}, ${
					chunk_size >= 1024 ? chunk_size / 1024 + ' KB' : chunk_size + ' B'
				} chunks) ---`,
			);
			const chunks = make_chunks(streaming_buf, bytes, chunk_size);

			const bench = new Benchmark({
				duration_ms,
				warmup_iterations,
				min_iterations: 3,
			});

			for (const runner of streamable) {
				bench.add(runner.label, () => {
					const h = runner.Hasher!.create();
					for (const chunk of chunks) {
						h.update(chunk);
					}
					h.finalize();
					h.free();
				});
			}

			gc?.();
			const results = await bench.run();
			const group_name = `streaming (${label})`;
			all_results.push({
				name: group_name,
				data_bytes: bytes,
				results: map_bench_results(results, runner_categories),
			});
			all_full_results.push({ name: group_name, results });

			console.log();
		}
	}

	// Stream function benchmarks (hash_stream, keyed_hash_stream, derive_key_stream)
	const stream_fn_runners = runners.filter((r) => r.hash_stream);
	if (stream_fn_runners.length > 0) {
		const make_stream = (chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
			new ReadableStream({
				start(controller) {
					for (const c of chunks) controller.enqueue(c);
					controller.close();
				},
			});

		// Pre-warm the async stream path before measuring. On Bun, the first async benchmark
		// group runs ~2x slower due to JIT tier transitions — threshold is in the tens of
		// thousands of iterations, far beyond warmup_iterations. Running unconditionally
		// ensures correctness on all runtimes (adds ~duration_ms, ~3% overhead per runtime).
		const warmup_chunks = make_chunks(streaming_buf, 1024, 64);
		const warmup_bench = new Benchmark({ duration_ms, warmup_iterations, min_iterations: 3 });
		warmup_bench.add(
			'_warmup',
			() => stream_fn_runners[0].hash_stream!(make_stream(warmup_chunks)),
		);
		await warmup_bench.run();

		const stream_fn_defs: Array<{
			name: string;
			eligible: BenchRunner[];
			make_task: (r: BenchRunner, chunks: Uint8Array[]) => () => Promise<Uint8Array>;
		}> = [
			{
				name: 'hash_stream',
				eligible: stream_fn_runners.filter((r) => r.hash_stream != null),
				make_task: (r, chunks) => () => r.hash_stream!(make_stream(chunks)),
			},
			{
				name: 'keyed_hash_stream',
				eligible: stream_fn_runners.filter((r) => r.keyed_hash_stream != null),
				make_task: (r, chunks) => () => r.keyed_hash_stream!(bench_key, make_stream(chunks)),
			},
			{
				name: 'derive_key_stream',
				eligible: stream_fn_runners.filter((r) => r.derive_key_stream != null),
				make_task: (r, chunks) => () => r.derive_key_stream!(bench_context, make_stream(chunks)),
			},
		];

		for (const { label, bytes, chunk_size } of streaming_sizes) {
			const chunks = make_chunks(streaming_buf, bytes, chunk_size);

			for (const { name, eligible, make_task } of stream_fn_defs) {
				if (eligible.length === 0) continue;

				console.log(`--- ${name} (${label}) ---`);
				const bench = new Benchmark({
					duration_ms,
					warmup_iterations,
					min_iterations: 3,
				});
				for (const runner of eligible) {
					bench.add(runner.label, make_task(runner, chunks));
				}
				gc?.();
				const results = await bench.run();
				const group_name = `${name} (${label})`;
				all_results.push({
					name: group_name,
					data_bytes: bytes,
					results: map_bench_results(results, runner_categories),
				});
				all_full_results.push({ name: group_name, results });
				console.log();
			}
		}
	}

	// Summary
	console.log(st('bold', '='.repeat(60)));
	console.log(st('bold', 'SUMMARY'));
	console.log(st('bold', '='.repeat(60)));
	console.log();

	const all_mean_ns = all_results.flatMap((g) => g.results.map((r) => r.stats.mean_ns));
	const unit = time_unit_detect_best(all_mean_ns);

	// Find reference runner for comparison annotations
	const ref_label = runners.find((r) => r.category === 'reference')?.label;

	let current_section: BenchSection | '' = '';
	for (const group of all_results) {
		// Section headers
		const section = get_bench_section(group.name);
		if (section !== current_section) {
			current_section = section;
			console.log(st('bold', SECTION_HEADERS[section]));
			console.log();
		}

		console.log(st('bold', `${group.name}:`));

		// Find reference runner's mean_ns in this group
		let group_ref_ns = ref_label
			? group.results.find((r) => r.name === ref_label)?.stats.mean_ns
			: undefined;
		let group_ref_label = ref_label;

		// Fallback: use blake3_wasm as reference for groups without the npm reference
		if (!group_ref_ns && group.results.length > 1) {
			const blake3_result = group.results.find((r) => r.name === 'blake3_wasm');
			if (blake3_result) {
				group_ref_ns = blake3_result.stats.mean_ns;
				group_ref_label = 'blake3_wasm';
			}
		}

		for (const result of group.results) {
			const time = time_format(result.stats.mean_ns, unit, 2);

			// Confidence interval — suppress when it rounds to zero
			const ci = result.stats.confidence_interval_ns;
			let ci_str = '';
			if (ci) {
				const margin = (ci[1] - ci[0]) / 2;
				const formatted = time_format(margin, unit, 1);
				const numeric = formatted.match(/^([\d.]+)/)?.[1] ?? '';
				if (numeric && parseFloat(numeric) > 0) ci_str = ` \u00b1${formatted}`;
			}

			// Ratio vs reference: >1 = faster, <1 = slower
			let ratio_str = '';
			if (group_ref_ns) {
				const ratio = group_ref_ns / result.stats.mean_ns;
				const text = `  ${ratio.toFixed(2)}`;
				if (result.name === group_ref_label) {
					ratio_str = st('dim', '  1.0');
				} else if (ratio > 1.05) {
					ratio_str = st('green', text);
				} else if (ratio < 0.95) {
					ratio_str = st('yellow', text);
				} else {
					ratio_str = st('dim', text);
				}
			}

			// Throughput (primary metric)
			const throughput = group.data_bytes
				? format_throughput(result.stats.ops_per_second, group.data_bytes)
				: '';

			if (throughput) {
				console.log(
					`  ${result.name.padEnd(28)} ${throughput.padStart(12)}  ${
						time.padStart(12)
					}${ci_str}${ratio_str}`,
				);
			} else {
				console.log(
					`  ${result.name.padEnd(28)} ${time.padStart(12)}${ci_str}${ratio_str}`,
				);
			}
		}
		console.log();
	}

	// WASM binary sizes
	const wasm_runners = runners.filter((r) => r.wasm_file);
	const wasm_sizes: Array<{ label: string; bytes: number }> = [];

	if (wasm_runners.length > 0) {
		console.log(st('bold', 'WASM BINARY SIZES:'));
		const max_label = Math.max(...wasm_runners.map((r) => r.wasm_file!.label.length));

		// Collect sizes first to find reference baseline
		for (const runner of wasm_runners) {
			const bytes = get_file_size(runner.wasm_file!.path);
			if (bytes > 0) {
				wasm_sizes.push({ label: runner.wasm_file!.label, bytes });
			}
		}

		const ref_runner = wasm_runners.find((r) => r.category === 'reference');
		const ref_size = ref_runner
			? wasm_sizes.find((s) => s.label === ref_runner.wasm_file!.label)?.bytes
			: undefined;

		for (const { label, bytes } of wasm_sizes) {
			const kb = (bytes / 1024).toFixed(1);
			let delta = '';
			if (ref_size) {
				if (label === ref_runner!.wasm_file!.label) {
					delta = '  baseline';
				} else {
					const diff = bytes - ref_size;
					delta = `  ${diff >= 0 ? '+' : ''}${diff} vs ${ref_runner!.wasm_file!.label}`;
				}
			}
			console.log(
				`  ${label.padEnd(max_label)}  ${String(bytes).padStart(8)} bytes  (${kb} KB)${delta}`,
			);
		}
	}

	// Notes
	const notes: string[] = [];
	if (ref_label === 'npm:blake3-wasm') {
		notes.push(
			`  ${ref_label} keyed_hash/derive_key use the streaming API internally (3 wasm calls)`,
			'  vs our keyed_hash/derive_key one-shot wasm exports (1 call), explaining the large gap at small sizes.',
		);
	}
	if (stream_fn_runners.length > 0) {
		notes.push(
			'  Stream functions (hash_stream, etc.) include ReadableStream + async reader.read()',
			'  overhead per iteration. Compare with "streaming" (sync hasher loop) for raw hash speed.',
			'  Deno has ~3x higher per-read() overhead than Node.js, dominating stream results at small sizes.',
		);
	}
	if (notes.length > 0) {
		console.log();
		console.log(st('bold', 'NOTES:'));
		for (const note of notes) {
			console.log(st('dim', note));
		}
	}

	// Build runner_categories for serialization
	const categories_record: Record<string, string> = {};
	for (const [label, cat] of runner_categories) {
		if (cat) categories_record[label] = cat;
	}

	// Build result
	const timestamp = new Date().toISOString();
	const suite_result: BenchSuiteResult = {
		runtime: runtime_label,
		timestamp,
		groups: all_results,
		wasm_sizes,
		runner_categories: categories_record,
	};

	// Write results if output path is configured
	if (output_json) {
		const results_dir = dirname(output_json);
		mkdirSync(results_dir, { recursive: true });

		// Fixed-name output (for cross-runtime report)
		writeFileSync(output_json, JSON.stringify(suite_result, null, '\t'));

		// Timestamped output (history)
		const ts = timestamp.replace(/[:.]/g, '-').slice(0, 19);
		const short = get_git_commit_short();
		const commit = short ? `_${short}` : '';
		const runtime_slug = runtime_label.toLowerCase().replace(/[^a-z0-9]/g, '');
		const base_path = `${results_dir}/${ts}_${runtime_slug}${commit}`;

		writeFileSync(`${base_path}.json`, JSON.stringify(suite_result, null, '\t'));

		// Generate per-runtime markdown with full benchmark tables
		const md_lines: string[] = [];
		md_lines.push(`# BLAKE3 Benchmark — ${runtime_label}`);
		md_lines.push('');
		md_lines.push(`**Date:** ${timestamp}`);
		md_lines.push('');
		let md_section: BenchSection | '' = '';
		for (const group of all_full_results) {
			const section = get_bench_section(group.name);
			if (section !== md_section) {
				md_section = section;
				md_lines.push(`## ${SECTION_HEADERS[section]}`);
				md_lines.push('');
			}
			md_lines.push(`### ${group.name}`);
			md_lines.push('');
			md_lines.push(benchmark_format_markdown(group.results));
			md_lines.push('');
		}
		if (wasm_sizes.length > 0) {
			md_lines.push('## WASM Binary Sizes');
			md_lines.push('');
			md_lines.push('| Binary | Size |');
			md_lines.push('| --- | ---: |');
			for (const { label, bytes } of wasm_sizes) {
				md_lines.push(`| ${label} | ${(bytes / 1024).toFixed(1)} KB |`);
			}
			md_lines.push('');
		}
		writeFileSync(`${base_path}.md`, md_lines.join('\n'));

		console.log(`\nResults written to ${output_json}`);
		console.log(`History saved to ${base_path}.{json,md}`);
	}

	return suite_result;
}
