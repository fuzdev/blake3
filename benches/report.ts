/**
 * Cross-runtime benchmark report.
 *
 * Auto-discovers JSON results from benches/results/ and produces
 * a side-by-side comparison with ratio annotations and visual bars.
 *
 * Run with: deno task bench:report
 *   or:     deno task bench:report:md  (markdown output)
 *
 * Flags:
 *   --markdown   Output markdown instead of text
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { time_format, time_unit_detect_best } from '@fuzdev/fuz_util/time.js';

import {
	type BenchGroupResult,
	type BenchSection,
	type BenchSuiteResult,
	format_throughput,
	get_bench_section,
	get_git_commit_short,
	SECTION_HEADERS,
} from './lib/bench_core.ts';
import { runtime_format, st } from './lib/color.ts';

const results_dir = 'benches/results';
const markdown_mode = process.argv.includes('--markdown');

// Auto-discover runtime results
const runtimes: BenchSuiteResult[] = [];
try {
	const files = readdirSync(results_dir).filter(
		(f) => f.endsWith('.json') && !/^\d/.test(f),
	);
	for (const file of files) {
		try {
			const data = readFileSync(`${results_dir}/${file}`, 'utf-8');
			runtimes.push(JSON.parse(data));
		} catch (e) {
			console.error(`Failed to parse ${results_dir}/${file}: ${e}`);
		}
	}
} catch {
	console.error(`No results directory found at ${results_dir}/`);
	process.exit(1);
}

// Sort by runtime name for consistent display order (Bun, Deno, Node.js)
runtimes.sort((a, b) => a.runtime.localeCompare(b.runtime));

if (runtimes.length < 2) {
	console.error('Need at least 2 runtime results to produce a cross-runtime report.');
	process.exit(1);
}

// Collect all mean_ns values for consistent unit selection
const all_ns = runtimes.flatMap((r) =>
	r.groups.flatMap((g) => g.results.map((res) => res.stats.mean_ns))
);
const unit = time_unit_detect_best(all_ns);

/** Get all runner names across runtimes for a group. */
function get_runner_names(group_name: string): string[] {
	const names = new Set<string>();
	for (const runtime of runtimes) {
		const group = runtime.groups.find((g) => g.name === group_name);
		if (group) {
			for (const r of group.results) names.add(r.name);
		}
	}
	return [...names];
}

/**
 * Get all runner names across ALL groups in stable first-appearance order.
 */
function get_all_runner_names(): string[] {
	const names = new Set<string>();
	for (const group_name of get_all_group_names()) {
		for (const name of get_runner_names(group_name)) {
			names.add(name);
		}
	}
	return [...names];
}

/**
 * Get runner names relevant to a specific group, in stable global order.
 *
 * Includes runners from any runtime that has data for this group — even if
 * a runner doesn't appear in that group (e.g. npm:blake3-wasm in stream function
 * groups). This produces consistent N/A rows for absent runners without adding
 * unrelated runners like blake3_component to JS-only tables.
 */
function get_relevant_runner_names(group_name: string): string[] {
	// Which runtimes have any data for this group?
	const active_runtimes = new Set(
		runtimes
			.filter((r) => r.groups.some((g) => g.name === group_name))
			.map((r) => r.runtime),
	);
	// All runners ever seen in those runtimes (across all groups)
	const relevant = new Set<string>();
	for (const runtime of runtimes) {
		if (!active_runtimes.has(runtime.runtime)) continue;
		for (const g of runtime.groups) {
			for (const r of g.results) relevant.add(r.name);
		}
	}
	// Return in stable global order
	return get_all_runner_names().filter((n) => relevant.has(n));
}

/**
 * Get all group names across all runtimes in a stable order.
 * Uses the runtime with the most groups as the ordering anchor,
 * then appends any group names from other runtimes not in that anchor.
 */
function get_all_group_names(): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	const anchor = [...runtimes].sort((a, b) => b.groups.length - a.groups.length)[0];
	for (const g of anchor.groups) {
		seen.add(g.name);
		ordered.push(g.name);
	}
	for (const r of runtimes) {
		for (const g of r.groups) {
			if (!seen.has(g.name)) {
				seen.add(g.name);
				ordered.push(g.name);
			}
		}
	}
	return ordered;
}

/** Get data_bytes for a group (from any runtime that has it). */
function get_data_bytes(group_name: string): number | null {
	for (const runtime of runtimes) {
		const group = runtime.groups.find((g) => g.name === group_name);
		if (group?.data_bytes) return group.data_bytes;
	}
	return null;
}

/** Get a runner's mean_ns from a runtime for a group. */
function get_mean_ns(
	runtime: BenchSuiteResult,
	group_name: string,
	runner_name: string,
): number | null {
	const group = runtime.groups.find((g) => g.name === group_name);
	const result = group?.results.find((r) => r.name === runner_name);
	return result?.stats.mean_ns ?? null;
}

/** Get a runner's full stats from a runtime for a group. */
function get_stats(
	runtime: BenchSuiteResult,
	group_name: string,
	runner_name: string,
): BenchGroupResult['results'][number]['stats'] | null {
	const group = runtime.groups.find((g) => g.name === group_name);
	const result = group?.results.find((r) => r.name === runner_name);
	return result?.stats ?? null;
}

/** Format CI margin as ±value in the same time unit. Suppressed when it rounds to zero. */
function format_ci(stats: BenchGroupResult['results'][number]['stats']): string {
	const ci = stats.confidence_interval_ns;
	if (!ci) return '';
	const margin = (ci[1] - ci[0]) / 2;
	const formatted = time_format(margin, unit, 1);
	// Suppress if numeric portion rounds to zero (e.g. "0.0μs")
	const numeric = formatted.match(/^([\d.]+)/)?.[1] ?? '';
	if (!numeric || parseFloat(numeric) === 0) return '';
	return formatted;
}

// ─── WASM SIZE GROUPING ──────────────────────────────────────────────────────

interface SizeGroup {
	label: string;
	sizes: Array<{ label: string; bytes: number }>;
}

/**
 * Group WASM sizes by format (wasm-bindgen vs component).
 * JS runtimes all report wasm-bindgen sizes; Wasmtime reports component sizes.
 * When multiple JS runtimes exist, use the one with the most entries.
 */
function get_size_groups(): SizeGroup[] {
	const groups: SizeGroup[] = [];
	let wasm_bindgen_best: BenchSuiteResult | undefined;

	for (const runtime of runtimes) {
		if (runtime.wasm_sizes.length === 0) continue;

		if (runtime.runtime === 'Wasmtime') {
			groups.push({ label: 'Component', sizes: runtime.wasm_sizes });
		} else {
			// Pick the JS runtime with the most size entries
			if (
				!wasm_bindgen_best ||
				runtime.wasm_sizes.length > wasm_bindgen_best.wasm_sizes.length
			) {
				wasm_bindgen_best = runtime;
			}
		}
	}

	if (wasm_bindgen_best) {
		groups.unshift({ label: 'wasm-bindgen', sizes: wasm_bindgen_best.wasm_sizes });
	}

	return groups;
}

/**
 * Resolve a runner's category from structured data, falling back to string matching
 * for backwards compatibility with result files that predate the category field.
 */
function get_runner_category(
	name: string,
	runtime: BenchSuiteResult,
): 'blake3' | 'reference' | undefined {
	// Prefer structured runner_categories field
	const cat = runtime.runner_categories?.[name];
	if (cat === 'blake3' || cat === 'reference') return cat;

	// Prefer per-result category field
	for (const group of runtime.groups) {
		const result = group.results.find((r) => r.name === name);
		if (result?.category) return result.category;
	}

	// Fallback: string matching for old result files
	if (name.includes('npm')) return 'reference';
	return 'blake3';
}

/**
 * Get runtimes that have data for at least one runner in this group.
 * Suppresses all-N/A columns (e.g. Wasmtime in stream_fn groups).
 */
function get_active_runtimes(group_name: string): BenchSuiteResult[] {
	return runtimes.filter((rt) =>
		rt.groups.some((g) => g.name === group_name && g.results.length > 0)
	);
}

/**
 * Filter runner names to those with data in at least one active runtime for this group.
 * Suppresses all-N/A rows (e.g. npm:blake3-wasm in stream_fn groups).
 */
function get_active_runner_names(
	group_name: string,
	active_runtimes: BenchSuiteResult[],
): string[] {
	return get_relevant_runner_names(group_name).filter((name) =>
		active_runtimes.some((rt) => get_mean_ns(rt, group_name, name) !== null)
	);
}

/** Groups to include in the bar chart — representative subset to avoid redundancy. */
const BAR_CHART_GROUPS = new Set([
	'hash (32 B)',
	'hash (1 KB)',
	'hash (64 KB)',
	'hash (1 MB)',
	'streaming (1 KB)',
	'streaming (64 KB)',
	'streaming (1 MB)',
	'hash_stream (1 KB)',
	'hash_stream (64 KB)',
	'hash_stream (1 MB)',
]);

/** Format the runtime comparison bar chart as plain text lines. */
function format_runtime_bars(use_colors = false): string[] {
	// Use explicit label — blake3_wasm_small runtime comparison is covered
	// by the per-group tables and the SIMD speedup table.
	const runner_name = 'blake3_wasm';

	const lines: string[] = [];
	const max_runtime_len = Math.max(...runtimes.map((r) => r.runtime.length));
	const bar_width = 40;

	const title = `RUNTIME COMPARISON (${runner_name}):`;
	lines.push(use_colors ? st('bold', title) : title);
	lines.push('');

	for (const group_name of get_all_group_names()) {
		if (!BAR_CHART_GROUPS.has(group_name)) continue;

		const entries: Array<{ runtime: string; mean_ns: number; index: number }> = [];
		for (let i = 0; i < runtimes.length; i++) {
			const ns = get_mean_ns(runtimes[i], group_name, runner_name);
			if (ns !== null) {
				entries.push({ runtime: runtimes[i].runtime, mean_ns: ns, index: i });
			}
		}

		if (entries.length < 2) continue;

		const min_ns = Math.min(...entries.map((e) => e.mean_ns));

		const data_bytes = get_data_bytes(group_name);
		lines.push(`  ${group_name}:`);

		// Pre-compute strings first to determine column widths for alignment
		const row_data = entries.map((entry) => {
			const filled_count = Math.round((min_ns / entry.mean_ns) * bar_width);
			const time_str = time_format(entry.mean_ns, unit, 2);
			const ops = entry.mean_ns > 0 ? 1_000_000_000 / entry.mean_ns : 0;
			const tp = data_bytes ? format_throughput(ops, data_bytes) : null;
			const relative = min_ns / entry.mean_ns; // 1.0 for best, <1 for slower
			const ratio_str = relative >= 0.95 ? '  1.0' : `  ${relative.toFixed(2)}`;
			return { entry, filled_count, time_str, tp, ratio_str };
		});
		const max_tp_width = data_bytes ? Math.max(...row_data.map((r) => r.tp?.length ?? 0)) : 0;
		const max_time_width = Math.max(...row_data.map((r) => r.time_str.length));

		for (const { entry, filled_count, time_str, tp, ratio_str } of row_data) {
			const filled = '\u2588'.repeat(filled_count);
			const empty = '\u2591'.repeat(bar_width - filled_count);
			const tp_padded = tp ? tp.padStart(max_tp_width) : '';

			if (use_colors) {
				const fmt = runtime_format(entry.runtime, entry.index);
				const primary = tp
					? `${tp_padded}${st('dim', `  ${time_str.padStart(max_time_width)}`)}`
					: time_str.padStart(max_time_width);
				lines.push(
					`    ${st(fmt, entry.runtime.padEnd(max_runtime_len))}  ${st(fmt, filled)}${
						st('dim', empty)
					}  ${primary}${st('dim', ratio_str)}`,
				);
			} else {
				const primary = tp
					? `${tp_padded}  ${time_str.padStart(max_time_width)}`
					: time_str.padStart(max_time_width);
				lines.push(
					`    ${entry.runtime.padEnd(max_runtime_len)}  ${filled}${empty}  ${primary}${ratio_str}`,
				);
			}
		}
		lines.push('');
	}

	return lines;
}

// ─── SIMD SPEEDUP TABLE ──────────────────────────────────────────────────────

/**
 * Compute SIMD speedup data: blake3_wasm_small_ns / blake3_wasm_ns per group per runtime.
 * Values >1 mean SIMD (blake3_wasm) is faster. Values <1 mean SIMD is slower (Bun regression).
 * Skips runtimes that don't have both runners (e.g. Wasmtime).
 */
function get_simd_speedup(): {
	runtimes_with_both: BenchSuiteResult[];
	groups: Array<{ name: string; speedups: Map<string, number> }>;
} | null {
	// Use explicit labels rather than positional index — robust to runner reordering.
	const blake3_name = 'blake3_wasm';
	const small_name = 'blake3_wasm_small';

	// Only include runtimes that have both runners
	const runtimes_with_both = runtimes.filter((r) => {
		const first_group = r.groups[0];
		if (!first_group) return false;
		const has_blake3 = first_group.results.some((res) => res.name === blake3_name);
		const has_small = first_group.results.some((res) => res.name === small_name);
		return has_blake3 && has_small;
	});

	if (runtimes_with_both.length === 0) return null;

	const first_runtime = runtimes_with_both[0];
	const groups: Array<{ name: string; speedups: Map<string, number> }> = [];

	for (const group of first_runtime.groups) {
		const speedups = new Map<string, number>();
		for (const runtime of runtimes_with_both) {
			const blake3_ns = get_mean_ns(runtime, group.name, blake3_name);
			const small_ns = get_mean_ns(runtime, group.name, small_name);
			if (blake3_ns !== null && small_ns !== null && blake3_ns > 0) {
				speedups.set(runtime.runtime, small_ns / blake3_ns);
			}
		}
		if (speedups.size > 0) {
			groups.push({ name: group.name, speedups });
		}
	}

	return { runtimes_with_both, groups };
}

// ─── VS NPM SPEEDUP TABLE ─────────────────────────────────────────────────────

/**
 * Compute vs npm:blake3-wasm speedup data: npm_ns / blake3_wasm_ns per group per runtime.
 * Values >1 mean our package (blake3_wasm) is faster. Values <1 mean npm is faster.
 * Skips runtimes that don't have both runners (e.g. Wasmtime).
 * Skips groups where either runner's data is absent (stream_fn groups, streaming groups).
 */
function get_vs_npm_speedup(): {
	runtimes_with_npm: BenchSuiteResult[];
	groups: Array<{ name: string; speedups: Map<string, number> }>;
} | null {
	const blake3_name = 'blake3_wasm';
	const npm_name = 'npm:blake3-wasm';

	// Only include runtimes that have both runners (JS runtimes only)
	const runtimes_with_npm = runtimes.filter((r) => {
		const first_group = r.groups[0];
		if (!first_group) return false;
		const has_blake3 = first_group.results.some((res) => res.name === blake3_name);
		const has_npm = first_group.results.some((res) => res.name === npm_name);
		return has_blake3 && has_npm;
	});

	if (runtimes_with_npm.length === 0) return null;

	const first_runtime = runtimes_with_npm[0];
	const groups: Array<{ name: string; speedups: Map<string, number> }> = [];

	for (const group of first_runtime.groups) {
		const speedups = new Map<string, number>();
		for (const runtime of runtimes_with_npm) {
			const npm_ns = get_mean_ns(runtime, group.name, npm_name);
			const our_ns = get_mean_ns(runtime, group.name, blake3_name);
			if (npm_ns !== null && our_ns !== null && our_ns > 0) {
				speedups.set(runtime.runtime, npm_ns / our_ns);
			}
		}
		if (speedups.size > 0) {
			groups.push({ name: group.name, speedups });
		}
	}

	return { runtimes_with_npm, groups };
}

// ─── NOTES ───────────────────────────────────────────────────────────────────

/** Build notes/caveats based on the loaded runtime data. */
function get_report_notes(): string[] {
	const notes: string[] = [];

	// Check if npm:blake3-wasm is present as reference
	const has_npm_ref = runtimes.some((r) =>
		r.groups.some((g) => g.results.some((res) => get_runner_category(res.name, r) === 'reference'))
	);
	if (has_npm_ref) {
		notes.push(
			'npm:blake3-wasm keyed_hash/derive_key use the streaming API internally (3 wasm calls) vs our one-shot wasm exports (1 call), explaining the large gap at small sizes.',
		);
	}

	// Check if stream functions are present
	const has_streams = runtimes.some((r) => r.groups.some((g) => g.name.includes('_stream')));
	if (has_streams) {
		notes.push(
			'Stream functions (hash_stream, etc.) include ReadableStream + async reader.read() overhead per iteration. Compare with "streaming" (sync hasher loop) for raw hash speed.',
		);
		notes.push(
			'Deno has ~3x higher per-read() overhead than Node.js, dominating stream results at small sizes.',
		);
	}

	// Check for Deno per-call WASM overhead
	const has_deno = runtimes.some((r) => r.runtime === 'Deno');
	const has_node = runtimes.some((r) => r.runtime === 'Node.js');
	if (has_deno) {
		notes.push(
			'Deno has ~5-9x higher per-call WASM overhead at small inputs vs Node.js (up to ~8x for hash at 32B). The wasm-bindgen glue code is identical — this is a Deno runtime characteristic.',
		);
	}
	if (has_deno && has_node) {
		notes.push(
			"At 1 MB, Deno's streaming throughput matches or slightly exceeds Node.js. The large Deno overhead at small inputs shrinks to <5% at 1 MB.",
		);
	}

	// Bun WASM SIMD regression
	const has_bun = runtimes.some((r) => r.runtime === 'Bun');
	if (has_bun) {
		notes.push(
			'Bun has a WASM SIMD regression — blake3_wasm (SIMD) is slower than blake3_wasm_small (no SIMD). This is a Bun runtime issue, not a code issue.',
		);
	}
	if (has_bun && has_npm_ref) {
		notes.push(
			'On Bun, blake3_wasm (SIMD) is slower than npm:blake3-wasm at most sizes due to the WASM SIMD regression. Prefer blake3_wasm_small on Bun — it achieves parity with npm at large inputs.',
		);
	}

	return notes;
}

// ─── TEXT OUTPUT ──────────────────────────────────────────────────────────────

function format_text(): string {
	const lines: string[] = [];

	lines.push(st('bold', 'Cross-Runtime Benchmark Report'));
	lines.push(st('bold', '='.repeat(70)));
	lines.push('');

	for (const runtime of runtimes) {
		lines.push(`  ${runtime.runtime}: ${runtime.timestamp}`);
	}
	lines.push('');

	const runtime_labels = runtimes.map((r) => r.runtime);
	const label_width = 28;

	// Pre-compute all cell text to determine dynamic column width
	const all_group_names = get_all_group_names();
	const cell_texts = new Map<
		string,
		Map<string, Map<string, { text: string; is_best: boolean }>>
	>();
	for (const group_name of all_group_names) {
		const data_bytes = get_data_bytes(group_name);
		const runner_cells = new Map<string, Map<string, { text: string; is_best: boolean }>>();
		for (const name of get_relevant_runner_names(group_name)) {
			const values: number[] = [];
			for (const runtime of runtimes) {
				const ns = get_mean_ns(runtime, group_name, name);
				if (ns !== null) values.push(ns);
			}
			const best_ns = Math.min(...values);
			const runtime_cells = new Map<string, { text: string; is_best: boolean }>();
			for (const runtime of runtimes) {
				const stats = get_stats(runtime, group_name, name);
				if (stats) {
					const formatted = time_format(stats.mean_ns, unit, 2);
					const relative = best_ns / stats.mean_ns; // 1.0 for best, <1 for slower
					const ci_val = format_ci(stats);
					const ci_str = ci_val ? ` \u00b1${ci_val}` : '';
					const ratio_str = relative < 0.95 ? ` (${relative.toFixed(2)})` : '';
					let text: string;
					if (data_bytes) {
						const tp = format_throughput(stats.ops_per_second, data_bytes);
						text = `${tp} (${formatted}${ci_str})${ratio_str}`;
					} else {
						text = `${formatted}${ci_str}${ratio_str}`;
					}
					runtime_cells.set(runtime.runtime, {
						text,
						is_best: !ratio_str,
					});
				} else {
					runtime_cells.set(runtime.runtime, { text: 'N/A', is_best: false });
				}
			}
			runner_cells.set(name, runtime_cells);
		}
		cell_texts.set(group_name, runner_cells);
	}

	// Find max cell width across all cells
	let max_cell_width = 0;
	for (const runner_cells of cell_texts.values()) {
		for (const runtime_cells of runner_cells.values()) {
			for (const { text } of runtime_cells.values()) {
				if (text.length > max_cell_width) max_cell_width = text.length;
			}
		}
	}
	const col_width = Math.max(
		max_cell_width + 2,
		Math.max(...runtime_labels.map((l) => l.length)) + 2,
	);

	// Tabular section with inline ratio annotations, throughput, and ±CI
	let current_section: BenchSection | '' = '';
	let component_rendered = false;
	for (const group_name of all_group_names) {
		const section = get_bench_section(group_name);

		// Component section: collapse all groups into one summary table
		if (section === 'component') {
			if (!component_rendered) {
				component_rendered = true;
				current_section = 'component';
				lines.push(st('bold', SECTION_HEADERS['component']));
				lines.push('');

				const comp_groups = all_group_names.filter(
					(g) => get_bench_section(g) === 'component',
				);
				const comp_runtimes = runtimes.filter((r) =>
					comp_groups.some((g) => r.groups.some((rg) => rg.name === g))
				);

				// Pre-compute cells to determine column width
				const comp_rows: Array<{ group: string; cells: Map<string, string> }> = [];
				let comp_max_cell = 0;
				for (const g of comp_groups) {
					const data_bytes = get_data_bytes(g);
					const row_cells = new Map<string, string>();
					for (const rt of comp_runtimes) {
						const result = rt.groups.find((rg) => rg.name === g)?.results[0];
						if (result) {
							const formatted = time_format(result.stats.mean_ns, unit, 2);
							const ci_val = format_ci(result.stats);
							const ci_str = ci_val ? ` \u00b1${ci_val}` : '';
							const cell = data_bytes
								? `${
									format_throughput(result.stats.ops_per_second, data_bytes)
								} (${formatted}${ci_str})`
								: `${formatted}${ci_str}`;
							row_cells.set(rt.runtime, cell);
							if (cell.length > comp_max_cell) comp_max_cell = cell.length;
						}
					}
					comp_rows.push({ group: g, cells: row_cells });
				}

				const comp_label_width = Math.max(
					24,
					...comp_groups.map((g) => g.length + 4),
				);
				const comp_col = Math.max(
					comp_max_cell + 2,
					Math.max(...comp_runtimes.map((r) => r.runtime.length)) + 2,
				);

				const comp_header = ''.padEnd(comp_label_width) +
					comp_runtimes.map((r) => {
						const i = runtimes.indexOf(r);
						return st(runtime_format(r.runtime, i), r.runtime.padStart(comp_col));
					}).join('');
				lines.push(comp_header);
				lines.push(
					''.padEnd(comp_label_width) + '-'.repeat(comp_col * comp_runtimes.length),
				);

				for (const { group, cells } of comp_rows) {
					let line = `  ${group.padEnd(comp_label_width - 2)}`;
					for (const rt of comp_runtimes) {
						const cell = cells.get(rt.runtime);
						line += cell
							? st('green', cell.padStart(comp_col))
							: st('dim', 'N/A'.padStart(comp_col));
					}
					lines.push(line);
				}
				lines.push('');
			}
			continue;
		}

		if (section !== current_section) {
			current_section = section;
			lines.push(st('bold', SECTION_HEADERS[section]));
			lines.push('');
		}

		lines.push(st('bold', `--- ${group_name} ---`));

		const group_runtimes = get_active_runtimes(group_name);
		const header = ''.padEnd(label_width) +
			group_runtimes.map((r) => {
				const i = runtimes.indexOf(r);
				return st(runtime_format(r.runtime, i), r.runtime.padStart(col_width));
			}).join('');
		lines.push(header);
		lines.push(''.padEnd(label_width) + '-'.repeat(col_width * group_runtimes.length));

		const runner_cells = cell_texts.get(group_name)!;
		const active_runners = get_active_runner_names(group_name, group_runtimes);
		for (const name of active_runners) {
			const runtime_cells = runner_cells.get(name);
			if (!runtime_cells) continue;
			let line = `  ${name.padEnd(label_width - 2)}`;
			for (const runtime of group_runtimes) {
				const cell = runtime_cells.get(runtime.runtime);
				if (cell) {
					const padded = cell.text.padStart(col_width);
					line += cell.is_best ? st('green', padded) : padded;
				} else {
					line += st('dim', 'N/A'.padStart(col_width));
				}
			}
			lines.push(line);
		}
		lines.push('');
	}

	// Visual bar summary
	const bars = format_runtime_bars(true);
	if (bars.length > 0) {
		lines.push(st('bold', '='.repeat(70)));
		lines.push(...bars);
	}

	// vs npm:blake3-wasm speedup table
	const vs_npm = get_vs_npm_speedup();
	if (vs_npm) {
		const title = 'VS npm:blake3-wasm (blake3_wasm speedup):';
		lines.push(st('bold', title));
		lines.push('');

		const runtime_labels_npm = vs_npm.runtimes_with_npm.map((r) => r.runtime);
		const npm_col = 12;
		const npm_label_width = Math.max(
			24,
			...vs_npm.groups.map((g) => g.name.length + 4),
		);

		const npm_header = ''.padEnd(npm_label_width) +
			runtime_labels_npm.map((l) => l.padStart(npm_col)).join('');
		lines.push(npm_header);

		for (const group of vs_npm.groups) {
			let line = `  ${group.name.padEnd(npm_label_width - 2)}`;
			for (const runtime_name of runtime_labels_npm) {
				const ratio = group.speedups.get(runtime_name);
				if (ratio !== undefined) {
					const padded = ratio.toFixed(2).padStart(npm_col);
					if (ratio > 1.05) line += st('green', padded);
					else if (ratio < 0.95) line += st('yellow', padded);
					else line += st('dim', padded);
				} else {
					line += st('dim', 'N/A'.padStart(npm_col));
				}
			}
			lines.push(line);
		}
		lines.push('');
		lines.push(st('dim', '  >1.0 = blake3_wasm faster, <1.0 = npm:blake3-wasm faster'));
		lines.push('');
	}

	// SIMD speedup table
	const simd = get_simd_speedup();
	if (simd) {
		const title = 'SIMD SPEEDUP (blake3_wasm vs blake3_wasm_small):';
		lines.push(st('bold', title));
		lines.push('');

		const runtime_labels_simd = simd.runtimes_with_both.map((r) => r.runtime);
		const simd_col = 12;
		const simd_label_width = Math.max(
			24,
			...simd.groups.map((g) => g.name.length + 4),
		);

		const simd_col_header = ''.padEnd(simd_label_width) +
			runtime_labels_simd.map((l) => l.padStart(simd_col)).join('');

		let simd_section: BenchSection | '' = '';
		for (const group of simd.groups) {
			const group_section = get_bench_section(group.name);
			if (group_section !== simd_section) {
				simd_section = group_section;
				lines.push(st('dim', `  ${SECTION_HEADERS[group_section]}:`));
				lines.push(simd_col_header);
			}
			let line = `  ${group.name.padEnd(simd_label_width - 2)}`;
			for (const runtime_name of runtime_labels_simd) {
				const ratio = group.speedups.get(runtime_name);
				if (ratio !== undefined) {
					const padded = ratio.toFixed(2).padStart(simd_col);
					if (ratio > 1.05) line += st('green', padded);
					else if (ratio < 0.95) line += st('yellow', padded);
					else line += st('dim', padded);
				} else {
					line += st('dim', 'N/A'.padStart(simd_col));
				}
			}
			lines.push(line);
		}
		lines.push('');
		lines.push(st('dim', '  >1.0 = SIMD faster, <1.0 = SIMD slower (Bun regression)'));
		lines.push('');
	}

	// WASM sizes
	const size_groups = get_size_groups();
	for (const group of size_groups) {
		const suffix = size_groups.length > 1 ? ` (${group.label})` : '';
		lines.push(st('bold', `WASM BINARY SIZES${suffix}:`));
		const max_label = Math.max(...group.sizes.map((s) => s.label.length));
		// Find the reference runner's WASM size as baseline, using the source runtime
		const source_runtime = runtimes.find((r) => r.wasm_sizes === group.sizes) ?? runtimes[0];
		const ref_entry = group.sizes.find(
			(s) => get_runner_category(s.label, source_runtime) === 'reference',
		);
		const ref_size = ref_entry?.bytes;
		for (const { label, bytes } of group.sizes) {
			const kb = (bytes / 1024).toFixed(1);
			let delta = '';
			if (ref_size) {
				if (get_runner_category(label, source_runtime) === 'reference') {
					delta = '  baseline';
				} else {
					const diff = bytes - ref_size;
					delta = `  ${diff >= 0 ? '+' : ''}${diff} vs ${ref_entry!.label}`;
				}
			}
			lines.push(
				`  ${label.padEnd(max_label)}  ${String(bytes).padStart(8)} bytes  (${kb} KB)${delta}`,
			);
		}
		lines.push('');
	}

	// Notes
	const report_notes = get_report_notes();
	if (report_notes.length > 0) {
		lines.push(st('bold', 'NOTES:'));
		for (const note of report_notes) {
			lines.push(st('dim', `  ${note}`));
		}
		lines.push('');
	}

	return lines.join('\n');
}

// ─── MARKDOWN OUTPUT ─────────────────────────────────────────────────────────

function format_markdown(): string {
	const lines: string[] = [];

	lines.push('# BLAKE3 Cross-Runtime Benchmark Report');
	lines.push('');
	lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
	lines.push('');

	for (const runtime of runtimes) {
		lines.push(`- **${runtime.runtime}**: ${runtime.timestamp}`);
	}
	lines.push('');

	const runtime_labels = runtimes.map((r) => r.runtime);

	let current_section: BenchSection | '' = '';
	let component_rendered_md = false;
	for (const group_name of get_all_group_names()) {
		const section = get_bench_section(group_name);

		// Component section: collapse all groups into one summary table
		if (section === 'component') {
			if (!component_rendered_md) {
				component_rendered_md = true;
				current_section = 'component';
				lines.push(`## ${SECTION_HEADERS['component']}`);
				lines.push('');

				const comp_groups = get_all_group_names().filter(
					(g) => get_bench_section(g) === 'component',
				);
				const comp_runtimes = runtimes.filter((r) =>
					comp_groups.some((g) => r.groups.some((rg) => rg.name === g))
				);
				const rt_labels = comp_runtimes.map((r) => r.runtime);

				lines.push(`| Group | ${rt_labels.join(' | ')} |`);
				lines.push(`| --- | ${rt_labels.map(() => '---:').join(' | ')} |`);

				for (const g of comp_groups) {
					const data_bytes = get_data_bytes(g);
					const cells = comp_runtimes.map((rt) => {
						const result = rt.groups.find((rg) => rg.name === g)?.results[0];
						if (!result) return 'N/A';
						const formatted = time_format(result.stats.mean_ns, unit, 2);
						const ci_val = format_ci(result.stats);
						const ci_str = ci_val ? ` \u00b1${ci_val}` : '';
						if (data_bytes) {
							const tp = format_throughput(result.stats.ops_per_second, data_bytes);
							return `**${tp}** (${formatted}${ci_str})`;
						}
						return `**${formatted}${ci_str}**`;
					});
					lines.push(`| ${g} | ${cells.join(' | ')} |`);
				}
				lines.push('');
			}
			continue;
		}

		if (section !== current_section) {
			current_section = section;
			lines.push(`## ${SECTION_HEADERS[section]}`);
			lines.push('');
		}
		lines.push(`### ${group_name}`);
		lines.push('');

		const group_runtimes_md = get_active_runtimes(group_name);
		const group_rt_labels = group_runtimes_md.map((r) => r.runtime);
		lines.push(`| Runner | ${group_rt_labels.join(' | ')} |`);
		lines.push(`| --- | ${group_rt_labels.map(() => '---:').join(' | ')} |`);

		const data_bytes = get_data_bytes(group_name);

		for (const name of get_active_runner_names(group_name, group_runtimes_md)) {
			const values: number[] = [];
			for (const runtime of group_runtimes_md) {
				const ns = get_mean_ns(runtime, group_name, name);
				if (ns !== null) values.push(ns);
			}
			const best_ns = values.length > 0 ? Math.min(...values) : Infinity;

			const cells: string[] = [];
			for (const runtime of group_runtimes_md) {
				const stats = get_stats(runtime, group_name, name);
				if (stats) {
					const formatted = time_format(stats.mean_ns, unit, 2);
					const ci_val = format_ci(stats);
					const ci_str = ci_val ? ` \u00b1${ci_val}` : '';
					const relative = best_ns / stats.mean_ns; // 1.0 for best, <1 for slower
					if (relative >= 0.95) {
						if (data_bytes) {
							const tp = format_throughput(stats.ops_per_second, data_bytes);
							cells.push(`**${tp}** (${formatted}${ci_str})`);
						} else {
							cells.push(`**${formatted}${ci_str}**`);
						}
					} else {
						if (data_bytes) {
							const tp = format_throughput(stats.ops_per_second, data_bytes);
							cells.push(`${tp} (${formatted}${ci_str}) (${relative.toFixed(2)})`);
						} else {
							cells.push(`${formatted}${ci_str} (${relative.toFixed(2)})`);
						}
					}
				} else {
					cells.push('N/A');
				}
			}

			lines.push(`| ${name} | ${cells.join(' | ')} |`);
		}
		lines.push('');
	}

	// Runtime comparison bars
	const bars = format_runtime_bars();
	if (bars.length > 0) {
		lines.push('## Runtime Comparison');
		lines.push('');
		lines.push('```text');
		lines.push(...bars);
		lines.push('```');
		lines.push('');
	}

	// vs npm:blake3-wasm speedup table
	const vs_npm_md = get_vs_npm_speedup();
	if (vs_npm_md) {
		lines.push('## vs npm:blake3-wasm (blake3_wasm speedup)');
		lines.push('');

		const runtime_labels_npm = vs_npm_md.runtimes_with_npm.map((r) => r.runtime);
		lines.push(`| Group | ${runtime_labels_npm.join(' | ')} |`);
		lines.push(`| --- | ${runtime_labels_npm.map(() => '---:').join(' | ')} |`);

		for (const group of vs_npm_md.groups) {
			const cells: string[] = [];
			for (const runtime_name of runtime_labels_npm) {
				const ratio = group.speedups.get(runtime_name);
				if (ratio !== undefined) {
					const text = ratio.toFixed(2);
					if (ratio > 1.05) {
						cells.push(`**${text}**`);
					} else if (ratio < 0.95) {
						cells.push(`*${text}*`);
					} else {
						cells.push(text);
					}
				} else {
					cells.push('N/A');
				}
			}
			lines.push(`| ${group.name} | ${cells.join(' | ')} |`);
		}
		lines.push('');
		lines.push(
			'>1.0 = blake3_wasm faster, <1.0 = npm:blake3-wasm faster. Bold = we win, italic = npm wins.',
		);
		lines.push('');
	}

	// SIMD speedup table (split by section)
	const simd = get_simd_speedup();
	if (simd) {
		lines.push('## SIMD Speedup (blake3_wasm vs blake3_wasm_small)');
		lines.push('');

		const runtime_labels_simd = simd.runtimes_with_both.map((r) => r.runtime);
		const simd_header_row = `| Group | ${runtime_labels_simd.join(' | ')} |`;
		const simd_sep_row = `| --- | ${runtime_labels_simd.map(() => '---:').join(' | ')} |`;

		let simd_section_md: BenchSection | '' = '';
		for (const group of simd.groups) {
			const group_section = get_bench_section(group.name);
			if (group_section !== simd_section_md) {
				if (simd_section_md !== '') lines.push('');
				simd_section_md = group_section;
				lines.push(`### ${SECTION_HEADERS[group_section]}`);
				lines.push('');
				lines.push(simd_header_row);
				lines.push(simd_sep_row);
			}
			const cells: string[] = [];
			for (const runtime_name of runtime_labels_simd) {
				const ratio = group.speedups.get(runtime_name);
				if (ratio !== undefined) {
					const text = ratio.toFixed(2);
					if (ratio > 1.05) {
						cells.push(`**${text}**`);
					} else if (ratio < 0.95) {
						cells.push(`*${text}*`);
					} else {
						cells.push(text);
					}
				} else {
					cells.push('N/A');
				}
			}
			lines.push(`| ${group.name} | ${cells.join(' | ')} |`);
		}
		lines.push('');
		lines.push(
			'>1.0 = SIMD faster, <1.0 = SIMD slower (Bun regression). Bold = SIMD wins, italic = SIMD loses.',
		);
		lines.push('');
	}

	// WASM sizes
	const size_groups = get_size_groups();
	if (size_groups.length > 0) {
		lines.push('## WASM Binary Sizes');
		lines.push('');
		for (const group of size_groups) {
			if (size_groups.length > 1) {
				lines.push(`### ${group.label}`);
				lines.push('');
			}
			const md_source_runtime = runtimes.find((r) => r.wasm_sizes === group.sizes) ?? runtimes[0];
			const md_ref_entry = group.sizes.find(
				(s) => get_runner_category(s.label, md_source_runtime) === 'reference',
			);
			const md_ref_size = md_ref_entry?.bytes;
			if (md_ref_size) {
				lines.push(`| Binary | Size | vs ${md_ref_entry!.label} |`);
				lines.push('| --- | ---: | ---: |');
			} else {
				lines.push('| Binary | Size |');
				lines.push('| --- | ---: |');
			}
			for (const { label, bytes } of group.sizes) {
				const kb = (bytes / 1024).toFixed(1);
				if (md_ref_size) {
					let delta = '';
					if (get_runner_category(label, md_source_runtime) === 'reference') {
						delta = 'baseline';
					} else {
						const diff = bytes - md_ref_size;
						const abs = Math.abs(diff).toLocaleString('en-US');
						delta = `${diff >= 0 ? '+' : '-'}${abs} bytes`;
					}
					lines.push(`| ${label} | ${kb} KB | ${delta} |`);
				} else {
					lines.push(`| ${label} | ${kb} KB |`);
				}
			}
			lines.push('');
		}
	}

	// Notes
	const md_notes = get_report_notes();
	if (md_notes.length > 0) {
		lines.push('## Notes');
		lines.push('');
		for (const note of md_notes) {
			lines.push(`- ${note}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const md = format_markdown();

if (markdown_mode) {
	console.log(md);
} else {
	console.log(format_text());
}

// Always save markdown (fixed-name + timestamped)
mkdirSync(results_dir, { recursive: true });
writeFileSync(`${results_dir}/report.md`, md);

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const short = get_git_commit_short();
const report_commit = short ? `_${short}` : '';
const history_path = `${results_dir}/${ts}_report${report_commit}.md`;
writeFileSync(history_path, md);

// Format generated markdown so it passes deno fmt --check
try {
	new Deno.Command('deno', {
		args: ['fmt', `${results_dir}/report.md`, history_path],
		stdout: 'null',
		stderr: 'null',
	}).outputSync();
} catch {
	// Non-fatal — deno may not be available in all environments
}

if (!markdown_mode) {
	console.log(`\nMarkdown saved to ${results_dir}/report.md`);
	console.log(`History saved to ${history_path}`);
}
