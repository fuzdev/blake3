import { meta } from '@fuzdev/fuz_schema/meta.ts';
import * as s from '@fuzdev/fuz_schema/schema.ts';
import type { FsReadDir } from '@fuzdev/gro/fs.ts';
import { fs } from '@fuzdev/gro/fs.ts';
import { create_fs_paths } from '@fuzdev/gro/fs_paths.ts';
import { SilentError, TaskError, type Task } from '@fuzdev/gro/task.ts';

import type { BenchSuiteResult } from './lib/bench_result.ts';
import { render_diff, type DiffInput } from './lib/diff.ts';

const RESULTS_DIR = 'benches/results';

/** @nodocs */
export const Args = s.object({
	_: s.with_default_fn(
		meta(s.array(s.string), {
			description:
				'the base and current result files, oldest first; without them, the two latest timestamped runs'
		}),
		() => []
	),
	threshold: s.with_default(
		meta(s.number, { description: 'the change in percent a significant difference must exceed' }),
		5
	),
	runtime: s.optional(
		meta(s.string, { description: 'compare only the latest two runs of this runtime' })
	)
});
export type Args = s.Infer<typeof Args>;

const read_result = async (dir: FsReadDir, path: string): Promise<BenchSuiteResult> =>
	JSON.parse(await dir.read_text(path));

/** @nodocs */
export const task: Task<Args> = {
	summary: 'compare two bench result files, failing on a significant regression',
	Args,
	run: async ({ args, log }) => {
		const { _: paths, threshold, runtime } = args;
		let base: DiffInput;
		let current: DiffInput;
		if (paths.length === 2) {
			if (runtime !== undefined) {
				throw new TaskError('--runtime selects the latest runs, so it takes no file paths');
			}
			const fs_paths = create_fs_paths(fs);
			const [base_path, current_path] = paths as [string, string];
			const base_file = await fs_paths.open_path(base_path);
			const current_file = await fs_paths.open_path(current_path);
			base = { path: base_path, result: await read_result(base_file.dir, base_file.path) };
			current = {
				path: current_path,
				result: await read_result(current_file.dir, current_file.path)
			};
		} else if (paths.length === 0) {
			[base, current] = await find_latest_two(fs.project.readonly(), runtime);
		} else {
			throw new TaskError('pass two result files, base then current, or none for the latest two');
		}

		const report = render_diff(base, current, threshold);
		log.raw(report.lines.join('\n'));
		if (report.regressions > 0) throw new SilentError();
	}
};

/**
 * The two most recent timestamped result files, optionally of one runtime, oldest first.
 * @throws `TaskError` - if there aren't two
 */
const find_latest_two = async (
	project: FsReadDir,
	runtime: string | undefined
): Promise<[DiffInput, DiffInput]> => {
	const names: Array<string> = [];
	if ((await project.stat(RESULTS_DIR))?.kind === 'directory') {
		for await (const entry of project.list(RESULTS_DIR)) {
			if (entry.kind === 'file' && entry.name.endsWith('.json') && /^\d/.test(entry.name)) {
				names.push(entry.name);
			}
		}
	}
	names.sort().reverse();

	const matching: Array<DiffInput> = [];
	for (const name of names) {
		if (matching.length >= 2) break;
		const path = `${RESULTS_DIR}/${name}`;
		let result: BenchSuiteResult;
		try {
			result = await read_result(project, path);
		} catch {
			continue;
		}
		if (runtime !== undefined && result.runtime.toLowerCase() !== runtime.toLowerCase()) continue;
		matching.push({ path, result });
	}

	const [newer, older] = matching;
	if (!newer || !older) {
		throw new TaskError(
			`Need at least 2 timestamped result files${
				runtime !== undefined ? ` for runtime "${runtime}"` : ''
			} in ${RESULTS_DIR}/`
		);
	}
	return [older, newer];
};
