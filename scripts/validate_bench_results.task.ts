import { fs } from '@fuzdev/gro/fs.ts';
import { SilentError, TaskError, type Task } from '@fuzdev/gro/task.ts';

import { is_fixed_name_result, validate_bench_result } from './lib/bench_result_validate.ts';

const RESULTS_DIR = 'benches/results';

/** @nodocs */
export const task: Task = {
	summary: "validate the fixed-name bench result JSON files against the report's schema",
	run: async ({ log }) => {
		const results = fs.project.readonly();
		const info = await results.stat(RESULTS_DIR);
		const names: Array<string> = [];
		if (info?.kind === 'directory') {
			for await (const entry of results.list(RESULTS_DIR)) {
				if (entry.kind === 'file' && is_fixed_name_result(entry.name)) names.push(entry.name);
			}
		}
		if (names.length === 0) {
			throw new TaskError(
				`no fixed-name result files in ${RESULTS_DIR}/ to validate: run a benchmark first (npm run bench)`
			);
		}
		names.sort();

		const lines: Array<string> = [];
		let passed = 0;
		let failed = 0;
		for (const name of names) {
			let data: unknown;
			let failures: Array<string>;
			try {
				data = JSON.parse(await results.read_text(`${RESULTS_DIR}/${name}`));
				failures = validate_bench_result(data);
			} catch (error) {
				failures = [`(root): invalid JSON: ${error}`];
			}
			if (failures.length === 0) {
				lines.push(`  PASS: ${name}`);
				passed++;
			} else {
				for (const failure of failures) lines.push(`  FAIL: ${name} — ${failure}`);
				failed += failures.length;
			}
		}
		lines.push('', `=== Results: ${passed} passed, ${failed} failed ===`);
		log.raw(lines.join('\n'));
		if (failed > 0) throw new SilentError();
	}
};
