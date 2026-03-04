/**
 * Benchmark regression detection.
 *
 * Compares two JSON result files and reports per-group per-runner changes
 * with statistical significance testing.
 *
 * Usage:
 *   deno task bench:diff                              # auto-detect latest two runs
 *   deno task bench:diff results/a.json results/b.json  # explicit files
 *   deno task bench:diff --threshold 10               # custom regression threshold (%)
 *   deno task bench:diff --runtime deno                # filter to a specific runtime
 *
 * Exit code 1 if any statistically significant regressions exceed the threshold.
 */

import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { benchmark_stats_compare } from '@fuzdev/fuz_util/benchmark_stats.js';
import { time_format, time_unit_detect_best } from '@fuzdev/fuz_util/time.js';

import type { BenchGroupResult, BenchSuiteResult } from './lib/bench_core.ts';
import { st } from './lib/color.ts';

const results_dir = 'benches/results';

// Parse args
const args = process.argv.slice(2);
let threshold_pct = 5;
let runtime_filter: string | undefined;
const file_args: string[] = [];

for (let i = 0; i < args.length; i++) {
	if (args[i] === '--threshold' && args[i + 1]) {
		threshold_pct = parseFloat(args[++i]);
	} else if (args[i] === '--runtime' && args[i + 1]) {
		runtime_filter = args[++i];
	} else if (!args[i].startsWith('--')) {
		file_args.push(args[i]);
	}
}

function load_result(path: string): BenchSuiteResult {
	const data = readFileSync(path, 'utf-8');
	return JSON.parse(data);
}

/**
 * Auto-detect the two most recent timestamped result files.
 * Optionally filtered by runtime name.
 */
function auto_detect_files(): [string, string] {
	const files = readdirSync(results_dir)
		.filter((f) => f.endsWith('.json') && /^\d/.test(f))
		.sort()
		.reverse();

	const matching: string[] = [];
	for (const file of files) {
		if (matching.length >= 2) break;
		const path = `${results_dir}/${file}`;
		if (runtime_filter) {
			try {
				const result = load_result(path);
				if (result.runtime.toLowerCase() !== runtime_filter.toLowerCase()) continue;
			} catch {
				continue;
			}
		}
		matching.push(path);
	}

	if (matching.length < 2) {
		console.error(
			`Need at least 2 timestamped result files${
				runtime_filter ? ` for runtime "${runtime_filter}"` : ''
			} in ${results_dir}/`,
		);
		process.exit(1);
	}

	// matching[0] is newer, matching[1] is older — return [old, new]
	return [matching[1], matching[0]];
}

const [base_path, current_path] = file_args.length >= 2
	? [file_args[0], file_args[1]]
	: auto_detect_files();

const base = load_result(base_path);
const current = load_result(current_path);

console.log(st('bold', 'Benchmark Diff Report'));
console.log(st('bold', '='.repeat(70)));
console.log();
console.log(`  Base:    ${base_path} (${base.runtime}, ${base.timestamp})`);
console.log(`  Current: ${current_path} (${current.runtime}, ${current.timestamp})`);
console.log(`  Threshold: ${threshold_pct}%`);
console.log();

// Collect all mean_ns for unit detection
const all_ns = [
	...base.groups.flatMap((g) => g.results.map((r) => r.stats.mean_ns)),
	...current.groups.flatMap((g) => g.results.map((r) => r.stats.mean_ns)),
];
const unit = time_unit_detect_best(all_ns);

interface DiffEntry {
	group: string;
	runner: string;
	base_mean: number;
	current_mean: number;
	change_pct: number;
	significant: boolean;
	effect_magnitude: string;
	p_value: number;
	verdict: 'regression' | 'improvement' | 'unchanged';
}

const diffs: DiffEntry[] = [];
let has_regression = false;

// Build lookup for current results
const current_groups = new Map<string, BenchGroupResult>();
for (const group of current.groups) {
	current_groups.set(group.name, group);
}

for (const base_group of base.groups) {
	const current_group = current_groups.get(base_group.name);
	if (!current_group) continue;

	for (const base_result of base_group.results) {
		const current_result = current_group.results.find((r) => r.name === base_result.name);
		if (!current_result) continue;

		const base_stats = base_result.stats;
		const current_stats = current_result.stats;

		// Calculate % change (positive = regression/slower, negative = improvement/faster)
		const change_pct = ((current_stats.mean_ns - base_stats.mean_ns) / base_stats.mean_ns) * 100;

		// Use benchmark_stats_compare if we have the required fields
		let significant = false;
		let effect_magnitude = 'unknown';
		let p_value = 1;

		if (base_stats.std_dev_ns != null && current_stats.std_dev_ns != null) {
			const comparison = benchmark_stats_compare(
				{
					mean_ns: base_stats.mean_ns,
					std_dev_ns: base_stats.std_dev_ns,
					sample_size: base_stats.sample_size,
					confidence_interval_ns: base_stats.confidence_interval_ns,
				},
				{
					mean_ns: current_stats.mean_ns,
					std_dev_ns: current_stats.std_dev_ns,
					sample_size: current_stats.sample_size,
					confidence_interval_ns: current_stats.confidence_interval_ns,
				},
			);
			significant = comparison.significant;
			effect_magnitude = comparison.effect_magnitude;
			p_value = comparison.p_value;
		}

		let verdict: DiffEntry['verdict'] = 'unchanged';
		if (significant && change_pct > threshold_pct) {
			verdict = 'regression';
			has_regression = true;
		} else if (significant && change_pct < -threshold_pct) {
			verdict = 'improvement';
		}

		diffs.push({
			group: base_group.name,
			runner: base_result.name,
			base_mean: base_stats.mean_ns,
			current_mean: current_stats.mean_ns,
			change_pct,
			significant,
			effect_magnitude,
			p_value,
			verdict,
		});
	}
}

// Display results
const label_width = 24;
const group_width = 22;

console.log(
	st(
		'bold',
		`${'Group'.padEnd(group_width)}${'Runner'.padEnd(label_width)}` +
			`${'Base'.padStart(12)}${'Current'.padStart(12)}${'Change'.padStart(10)}` +
			`${'p-value'.padStart(10)}  Verdict`,
	),
);
console.log('-'.repeat(100));

let current_group = '';
for (const d of diffs) {
	if (d.group !== current_group) {
		if (current_group) console.log();
		current_group = d.group;
	}

	const base_fmt = time_format(d.base_mean, unit, 2);
	const current_fmt = time_format(d.current_mean, unit, 2);
	const change_str = `${d.change_pct >= 0 ? '+' : ''}${d.change_pct.toFixed(1)}%`;
	const p_str = d.p_value < 0.001 ? '<0.001' : d.p_value.toFixed(3);

	let verdict_str: string;
	if (d.verdict === 'regression') {
		verdict_str = st('red', `REGRESSION (${d.effect_magnitude})`);
	} else if (d.verdict === 'improvement') {
		verdict_str = st('green', `improved (${d.effect_magnitude})`);
	} else if (d.significant) {
		verdict_str = st('dim', `sig. but <${threshold_pct}%`);
	} else {
		verdict_str = st('dim', 'unchanged');
	}

	const change_colored = d.change_pct > threshold_pct && d.significant
		? st('red', change_str.padStart(10))
		: d.change_pct < -threshold_pct && d.significant
		? st('green', change_str.padStart(10))
		: change_str.padStart(10);

	console.log(
		`${d.group.padEnd(group_width)}${d.runner.padEnd(label_width)}` +
			`${base_fmt.padStart(12)}${current_fmt.padStart(12)}${change_colored}` +
			`${p_str.padStart(10)}  ${verdict_str}`,
	);
}

// Summary
console.log();
const regressions = diffs.filter((d) => d.verdict === 'regression');
const improvements = diffs.filter((d) => d.verdict === 'improvement');
console.log(st('bold', 'Summary:'));
console.log(
	`  ${diffs.length} comparisons, ` +
		`${regressions.length} regressions, ` +
		`${improvements.length} improvements`,
);

if (has_regression) {
	console.log();
	console.log(
		st(
			'red',
			`FAIL: ${regressions.length} significant regression(s) above ${threshold_pct}% threshold`,
		),
	);
	process.exit(1);
} else {
	console.log();
	console.log(st('green', 'PASS: No significant regressions detected'));
}
