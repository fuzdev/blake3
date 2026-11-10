/**
 * Benchmark regression detection between two result files: per group and runner, the change
 * in mean time and whether it's significant, by Welch's t-test with Cohen's d for effect size.
 *
 * @module
 */

import { benchmark_stats_compare } from '@fuzdev/fuz_util/benchmark_stats.ts';
import { time_format, time_unit_detect_best } from '@fuzdev/fuz_util/time.ts';

import type { BenchGroupResult, BenchSuiteResult } from './bench_result.ts';
import { st } from './color.ts';

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

/** A results file and the path it was read from, for display. */
export interface DiffInput {
	path: string;
	result: BenchSuiteResult;
}

export interface DiffReport {
	/** The report's lines, in order. */
	lines: Array<string>;
	/** How many changes are significant regressions above the threshold. */
	regressions: number;
}

/**
 * Compares `current` against `base`.
 * @param threshold_pct - the change in percent a significant difference must exceed
 * to count as a regression or an improvement
 */
export const render_diff = (
	{ path: base_path, result: base }: DiffInput,
	{ path: current_path, result: current }: DiffInput,
	threshold_pct: number
): DiffReport => {
	const lines: Array<string> = [];

	lines.push(st('bold', 'Benchmark Diff Report'));
	lines.push(st('bold', '='.repeat(70)));
	lines.push('');
	lines.push(`  Base:    ${base_path} (${base.runtime}, ${base.timestamp})`);
	lines.push(`  Current: ${current_path} (${current.runtime}, ${current.timestamp})`);
	lines.push(`  Threshold: ${threshold_pct}%`);
	lines.push('');

	// Collect all mean_ns for unit detection
	const all_ns = [
		...base.groups.flatMap((g) => g.results.map((r) => r.stats.mean_ns)),
		...current.groups.flatMap((g) => g.results.map((r) => r.stats.mean_ns))
	];
	const unit = time_unit_detect_best(all_ns);

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
						confidence_interval_ns: base_stats.confidence_interval_ns
					},
					{
						mean_ns: current_stats.mean_ns,
						std_dev_ns: current_stats.std_dev_ns,
						sample_size: current_stats.sample_size,
						confidence_interval_ns: current_stats.confidence_interval_ns
					}
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
				verdict
			});
		}
	}

	// Display results
	const label_width = 24;
	const group_width = 22;

	lines.push(
		st(
			'bold',
			`${'Group'.padEnd(group_width)}${'Runner'.padEnd(label_width)}` +
				`${'Base'.padStart(12)}${'Current'.padStart(12)}${'Change'.padStart(10)}` +
				`${'p-value'.padStart(10)}  Verdict`
		)
	);
	lines.push('-'.repeat(100));

	let current_group = '';
	for (const d of diffs) {
		if (d.group !== current_group) {
			if (current_group) lines.push('');
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

		const change_colored =
			d.change_pct > threshold_pct && d.significant
				? st('red', change_str.padStart(10))
				: d.change_pct < -threshold_pct && d.significant
					? st('green', change_str.padStart(10))
					: change_str.padStart(10);

		lines.push(
			`${d.group.padEnd(group_width)}${d.runner.padEnd(label_width)}` +
				`${base_fmt.padStart(12)}${current_fmt.padStart(12)}${change_colored}` +
				`${p_str.padStart(10)}  ${verdict_str}`
		);
	}

	// Summary
	lines.push('');
	const regressions = diffs.filter((d) => d.verdict === 'regression');
	const improvements = diffs.filter((d) => d.verdict === 'improvement');
	lines.push(st('bold', 'Summary:'));
	lines.push(
		`  ${diffs.length} comparisons, ` +
			`${regressions.length} regressions, ` +
			`${improvements.length} improvements`
	);

	lines.push('');
	if (has_regression) {
		lines.push(
			st(
				'red',
				`FAIL: ${regressions.length} significant regression(s) above ${threshold_pct}% threshold`
			)
		);
	} else {
		lines.push(st('green', 'PASS: No significant regressions detected'));
	}
	return { lines, regressions: regressions.length };
};
