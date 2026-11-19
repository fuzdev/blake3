import { fs } from '@fuzdev/gro/fs.ts';
import type { Task } from '@fuzdev/gro/task.ts';
import { SilentError } from '@fuzdev/gro/task_error.ts';

import { validate_wasm_size } from './lib/wasm_size.ts';

/** @nodocs */
export const task: Task = {
	summary: 'check the built WASM packages: binary sizes and npm package structure',
	run: async ({ log }) => {
		const report = await validate_wasm_size(fs.project.readonly());
		log.raw(report.lines.join('\n'));
		if (report.failed > 0) throw new SilentError();
	}
};
