import { meta } from '@fuzdev/fuz_schema/meta.ts';
import * as s from '@fuzdev/fuz_schema/schema.ts';
import { fs } from '@fuzdev/gro/fs.ts';
import { create_fs_paths } from '@fuzdev/gro/fs_paths.ts';
import { TaskError, type Task } from '@fuzdev/gro/task.ts';

import { patch_npm_package } from './lib/npm_package.ts';

/** @nodocs */
export const Args = s.object({
	_: s.with_default_fn(
		meta(s.array(s.string), {
			description: 'the wasm-pack web target output to patch, like crates/blake3_wasm/pkg'
		}),
		() => []
	)
});
export type Args = s.Infer<typeof Args>;

/** @nodocs */
export const task: Task<Args> = {
	summary: "turn wasm-pack's web target output into the npm package, in place",
	Args,
	run: async ({ args, log }) => {
		const [pkg_path, ...rest] = args._;
		if (pkg_path === undefined || rest.length > 0) {
			throw new TaskError(
				'pass exactly one package directory: gro task scripts/patch_npm_package.task.ts <pkg-dir>'
			);
		}
		const fs_paths = create_fs_paths(fs);
		const opened = await fs_paths.open_dir_path(pkg_path);
		const info = opened && (await opened.dir.stat(opened.path || '.'));
		if (!opened || info?.kind !== 'directory') {
			throw new TaskError(`no package directory at ${pkg_path}: build it with wasm-pack first`);
		}
		await patch_npm_package({
			pkg_dir: opened.path === '' ? opened.dir : opened.dir.dir(opened.path),
			project: fs.project.readonly(),
			log: (message) => log.info(`${pkg_path}: ${message}`)
		});
	}
};
