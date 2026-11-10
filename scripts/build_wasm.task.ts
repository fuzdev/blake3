import { spawn } from '@fuzdev/gro/spawn.ts';
import { SilentError, TaskError, type Task } from '@fuzdev/gro/task.ts';

/** The package scripts that build each WASM package, run concurrently. */
const BUILDS: ReadonlyArray<{ label: string; script: string }> = [
	{ label: 'blake3_wasm (SIMD)', script: 'build:wasm:simd' },
	{ label: 'blake3_wasm_small (no SIMD)', script: 'build:wasm:small' }
];

/** @nodocs */
export const task: Task = {
	summary: 'build both WASM packages concurrently, each through its package script',
	run: async ({ log }) => {
		// the whole environment: npm runs wasm-pack, which runs cargo, rustc, and wasm-opt, and
		// what they read (proxies, certificates, compiler wrappers, CI settings) is the user's
		// toolchain setup, not a set this task can name
		const npm = spawn.find('npm', { pass_env: 'all' });
		if (!npm) throw new TaskError('npm not found on PATH');

		const failed: Array<string> = [];
		await Promise.all(
			BUILDS.map(async ({ label, script }) => {
				log.info(`[${label}] npm run ${script}`);
				const result = await npm.out(['run', script]);
				if (result.kind === 'exited' && result.code === 0 && !result.truncated) {
					log.info(`[${label}] npm run ${script} ✓`);
					return;
				}
				const ended = result.kind === 'exited' ? `exit ${result.code}` : result.kind;
				log.error(`[${label}] FAIL: npm run ${script} (${ended})`);
				if (result.stdout) log.error(result.stdout);
				if (result.stderr) log.error(result.stderr);
				failed.push(label);
			})
		);
		if (failed.length > 0) {
			log.error(`${failed.length} build(s) failed: ${failed.join(', ')}`);
			throw new SilentError();
		}
		log.info('All WASM targets built successfully.');
	}
};
