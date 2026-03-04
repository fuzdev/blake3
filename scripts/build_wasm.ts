/**
 * Builds all WASM targets in parallel.
 *
 * Runs blake3_wasm (SIMD) and blake3_wasm_small (no SIMD) builds concurrently.
 * Within each package, deno and web targets run sequentially (they share cargo
 * intermediate artifacts via the same RUSTFLAGS).
 *
 * Usage: deno task build:wasm
 *
 * @module
 */

const dec = new TextDecoder();

interface BuildGroup {
	label: string;
	tasks: string[];
}

const groups: BuildGroup[] = [
	{
		label: 'blake3_wasm (SIMD)',
		tasks: ['build:wasm:deno', 'build:wasm:web'],
	},
	{
		label: 'blake3_wasm_small (no SIMD)',
		tasks: ['build:wasm:small:deno', 'build:wasm:small:web'],
	},
];

console.log(`Building ${groups.length} packages in parallel...\n`);

const results = await Promise.all(groups.map((group) => run_group(group)));

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
	console.error(`\nFAIL: ${failed.length} build group(s) failed:`);
	for (const f of failed) {
		console.error(`  - ${f.label}`);
	}
	Deno.exit(1);
}

console.log('\nAll WASM targets built successfully.');

async function run_group(group: BuildGroup): Promise<{ ok: boolean; label: string }> {
	for (const task of group.tasks) {
		console.log(`[${group.label}] deno task ${task}`);
		const result = await new Deno.Command('deno', {
			args: ['task', task],
			stdout: 'piped',
			stderr: 'piped',
		}).output();
		if (!result.success) {
			const stderr = dec.decode(result.stderr);
			const stdout = dec.decode(result.stdout);
			console.error(`\n[${group.label}] FAIL: deno task ${task} (exit ${result.code})`);
			if (stdout) console.error(stdout);
			if (stderr) console.error(stderr);
			return { ok: false, label: group.label };
		}
		console.log(`[${group.label}] deno task ${task} ✓`);
	}
	return { ok: true, label: group.label };
}
