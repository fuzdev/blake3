import { meta } from '@fuzdev/fuz_schema/meta.ts';
import * as s from '@fuzdev/fuz_schema/schema.ts';
import { fs } from '@fuzdev/gro/fs.ts';
import { GIT_LOCAL_PASS_ENV, to_git_program } from '@fuzdev/gro/git.ts';
import { spawn } from '@fuzdev/gro/spawn.ts';
import { TaskError, type Task } from '@fuzdev/gro/task.ts';

import { run_release } from './lib/release.ts';

/** @nodocs */
export const Args = s.object({
	wetrun: s.with_default(
		meta(s.boolean, {
			description: 'bump the version, sync it, and publish to npm, rather than only validate'
		}),
		false
	)
});
export type Args = s.Infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: 'release both npm packages: dry-run validation by default, --wetrun to publish',
	Args,
	run: async ({ args, log }) => {
		// npm and changeset get the whole environment: publishing reads the user's registry
		// config and credentials, and the package scripts npm runs build with the user's toolchain
		const npm = spawn.find('npm', { pass_env: 'all' });
		if (!npm) throw new TaskError('npm not found on PATH');
		await run_release(
			{
				project: fs.project,
				git: to_git_program(spawn, { pass_env: GIT_LOCAL_PASS_ENV }),
				npm,
				changeset: spawn.find('changeset', { pass_env: 'all' }),
				log: { info: (message) => log.info(message), warn: (message) => log.warn(message) }
			},
			args
		);
	}
};
