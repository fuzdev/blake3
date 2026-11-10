/**
 * The benchmark result format shared by the JS harness, the Wasmtime runner,
 * the report, and the diff, plus the formatting they agree on. Pure: no I/O,
 * so the gro tasks that read results import nothing the harness needs.
 *
 * @module
 */

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
	component: 'Component model'
};

/** Determine which section a benchmark group belongs to. */
export function get_bench_section(group_name: string): BenchSection {
	if (group_name.startsWith('streaming')) return 'streaming';
	if (group_name.includes('_stream')) return 'stream_fn';
	// keyed_hash / derive_key without _bytes suffix are component model-only groups
	if (/^(keyed_hash|derive_key) /.test(group_name)) return 'component';
	return 'one_shot';
}
