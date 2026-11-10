import * as s from '@fuzdev/fuz_schema/schema.ts';
import { fs } from '@fuzdev/gro/fs.ts';
import { GIT_LOCAL_PASS_ENV } from '@fuzdev/gro/git.ts';
import { spawn } from '@fuzdev/gro/spawn.ts';
import { TaskError, type Task } from '@fuzdev/gro/task.ts';

import type { BenchSuiteResult } from './lib/bench_result.ts';
import { render_report } from './lib/report.ts';

const RESULTS_DIR = 'benches/results';

/** @nodocs */
export const Args = s.object({});
export type Args = s.Infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: `render the cross-runtime report from ${RESULTS_DIR}/, saving it as report.md and a history file`,
	Args,
	run: async ({ log }) => {
		const project = fs.project;
		if ((await project.stat(RESULTS_DIR))?.kind !== 'directory') {
			throw new TaskError(`No results directory found at ${RESULTS_DIR}/`);
		}

		const runtimes: Array<BenchSuiteResult> = [];
		for await (const entry of project.list(RESULTS_DIR)) {
			if (entry.kind !== 'file' || !entry.name.endsWith('.json') || /^\d/.test(entry.name)) {
				continue;
			}
			const path = `${RESULTS_DIR}/${entry.name}`;
			try {
				runtimes.push(JSON.parse(await project.read_text(path)));
			} catch (error) {
				log.error(`Failed to parse ${path}: ${error}`);
			}
		}
		// sorted by runtime name for a stable display order (Bun, Deno, Node.js, Wasmtime)
		runtimes.sort((a, b) => a.runtime.localeCompare(b.runtime));
		if (runtimes.length < 2) {
			throw new TaskError('Need at least 2 runtime results to produce a cross-runtime report.');
		}

		const now = new Date().toISOString();
		const report = render_report(runtimes, { date: now.split('T')[0]! });
		log.raw(report.text);

		// the markdown is saved under a fixed name and as history
		const short = await get_git_commit_short();
		const history_path = `${RESULTS_DIR}/${now.replace(/[:.]/g, '-').slice(0, 19)}_report${
			short ? `_${short}` : ''
		}.md`;
		await project.write(`${RESULTS_DIR}/report.md`, report.markdown);
		await project.write(history_path, report.markdown);

		log.raw(`\nMarkdown saved to ${RESULTS_DIR}/report.md\nHistory saved to ${history_path}`);
	}
};

/** The short hash of `HEAD`, or `''` outside a repo or on an unborn branch. */
const get_git_commit_short = async (): Promise<string> => {
	const git = spawn.find('git', { pass_env: GIT_LOCAL_PASS_ENV });
	if (!git) return '';
	const result = await git.out(['rev-parse', '--short', 'HEAD']);
	return result.kind === 'exited' && result.code === 0 && !result.truncated
		? result.stdout.trim()
		: '';
};
