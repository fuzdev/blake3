/**
 * Validates bench result JSON against the `BenchSuiteResult` shape.
 *
 * Catches drift between the Rust structs (`blake3_bench_wasmtime`) and the TS interfaces
 * (`benches/lib/bench_result.ts`) by validating the JSON output they share.
 *
 * @module
 */

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
	'max_ns'
] as const;

/** Optional stats fields (fuz_util Benchmark outputs these, Wasmtime doesn't). */
const OPTIONAL_STATS_FIELDS = [
	'cv',
	'outliers_ns',
	'outlier_ratio',
	'raw_sample_size',
	'failed_iterations'
] as const;

function is_record(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Whether a results file is a fixed-name output, which the report reads, not a timestamped one. */
export const is_fixed_name_result = (name: string): boolean =>
	name.endsWith('.json') && !/^\d/.test(name);

/**
 * Validates one parsed results file.
 * @returns each problem as `path: message`, empty when the data has the expected shape
 */
export const validate_bench_result = (data: unknown): Array<string> => {
	const failures: Array<string> = [];
	const fail = (path: string, msg: string): void => {
		failures.push(`${path}: ${msg}`);
	};

	if (!is_record(data)) {
		fail('(root)', 'expected object');
		return failures;
	}

	// Top-level fields
	if (typeof data.runtime !== 'string') {
		fail('runtime', `expected string, got ${typeof data.runtime}`);
	}
	if (typeof data.timestamp !== 'string') {
		fail('timestamp', `expected string, got ${typeof data.timestamp}`);
	}

	// Groups
	if (!Array.isArray(data.groups)) {
		fail('groups', `expected array, got ${typeof data.groups}`);
	} else {
		for (let gi = 0; gi < data.groups.length; gi++) {
			const group: unknown = data.groups[gi];
			const gp = `groups[${gi}]`;

			if (!is_record(group)) {
				fail(gp, 'expected object');
				continue;
			}
			if (typeof group.name !== 'string') {
				fail(`${gp}.name`, `expected string, got ${typeof group.name}`);
			}
			if (group.data_bytes !== undefined && typeof group.data_bytes !== 'number') {
				fail(`${gp}.data_bytes`, `expected number, got ${typeof group.data_bytes}`);
			}
			if (!Array.isArray(group.results)) {
				fail(`${gp}.results`, `expected array, got ${typeof group.results}`);
				continue;
			}

			for (let ri = 0; ri < group.results.length; ri++) {
				const result: unknown = group.results[ri];
				const rp = `${gp}.results[${ri}]`;

				if (!is_record(result)) {
					fail(rp, 'expected object');
					continue;
				}
				if (typeof result.name !== 'string') {
					fail(`${rp}.name`, `expected string, got ${typeof result.name}`);
				}
				if (
					result.category !== undefined &&
					result.category !== 'blake3' &&
					result.category !== 'reference' &&
					result.category !== 'baseline'
				) {
					fail(
						`${rp}.category`,
						`expected 'blake3'|'reference'|'baseline', got '${result.category}'`
					);
				}
				if (!is_record(result.stats)) {
					fail(`${rp}.stats`, `expected object, got ${typeof result.stats}`);
					continue;
				}

				for (const field of STATS_NUMBER_FIELDS) {
					if (typeof result.stats[field] !== 'number') {
						fail(`${rp}.stats.${field}`, `expected number, got ${typeof result.stats[field]}`);
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
						`${rp}.stats.confidence_interval_ns`,
						`expected [number, number], got ${JSON.stringify(ci)}`
					);
				}

				// Check for unexpected stats fields
				const known_stats: readonly string[] = [
					...STATS_NUMBER_FIELDS,
					'confidence_interval_ns',
					...OPTIONAL_STATS_FIELDS
				];
				const extra = Object.keys(result.stats).filter((k) => !known_stats.includes(k));
				if (extra.length > 0) {
					fail(`${rp}.stats`, `unexpected fields: ${extra.join(', ')}`);
				}
			}
		}
	}

	// WASM sizes
	if (!Array.isArray(data.wasm_sizes)) {
		fail('wasm_sizes', `expected array, got ${typeof data.wasm_sizes}`);
	} else {
		for (let i = 0; i < data.wasm_sizes.length; i++) {
			const ws: unknown = data.wasm_sizes[i];
			const wp = `wasm_sizes[${i}]`;

			if (!is_record(ws)) {
				fail(wp, 'expected object');
				continue;
			}
			if (typeof ws.label !== 'string') {
				fail(`${wp}.label`, `expected string, got ${typeof ws.label}`);
			}
			if (typeof ws.bytes !== 'number') {
				fail(`${wp}.bytes`, `expected number, got ${typeof ws.bytes}`);
			}
		}
	}

	// runner_categories (optional)
	if (data.runner_categories !== undefined) {
		if (!is_record(data.runner_categories)) {
			fail('runner_categories', `expected object, got ${typeof data.runner_categories}`);
		} else {
			for (const [key, val] of Object.entries(data.runner_categories)) {
				if (typeof val !== 'string') {
					fail(`runner_categories.${key}`, `expected string, got ${typeof val}`);
				}
			}
		}
	}

	// Check for unexpected top-level fields
	const expected_top = ['runtime', 'timestamp', 'groups', 'wasm_sizes', 'runner_categories'];
	const extra_top = Object.keys(data).filter((k) => !expected_top.includes(k));
	if (extra_top.length > 0) {
		fail('(root)', `unexpected fields: ${extra_top.join(', ')}`);
	}

	return failures;
};
