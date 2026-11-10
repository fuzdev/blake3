/**
 * Unit tests for the repo's tooling modules (`scripts/lib/`, `benches/lib/`) and the release
 * task's flags. Needs no build. The release pipeline runs here only against fake programs
 * and a temp directory, never the real npm, changeset, or git.
 *
 * Usage: node --test scripts/test_tooling.ts
 *
 * @module
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { args_parse } from '@fuzdev/fuz_util/args.ts';
import { to_task_args } from '@fuzdev/gro/args.ts';
import { fs } from '@fuzdev/gro/fs.ts';
import type { FsDir } from '@fuzdev/gro/fs.ts';
import type { SpawnCallOptions, SpawnOutput, SpawnResult } from '@fuzdev/gro/spawn.ts';

import type { BenchSuiteResult } from '../benches/lib/bench_result.ts';
import { render_diff } from '../benches/lib/diff.ts';
import { align_markdown_tables } from '../benches/lib/markdown_table.ts';
import { render_report } from '../benches/lib/report.ts';
import { validate_bench_result } from './lib/bench_result_validate.ts';
import {
	NPM_PACKAGE_SOURCES,
	patch_npm_package,
	render_npm_readme,
	strip_stream_types,
	to_wasm_pack_files
} from './lib/npm_package.ts';
import {
	RELEASE_PACKAGES,
	RELEASE_SENTINEL_PATH,
	RELEASE_VALIDATIONS,
	run_release
} from './lib/release.ts';
import { validate_wasm_size } from './lib/wasm_size.ts';
import { Args as ReleaseArgs } from './release.task.ts';

/** Parses CLI flags for a task the way `gro task <path> ...flags` does. */
const parse_task_flags = (path: string, flags: Array<string>) => {
	const { args } = to_task_args(['task', path, ...flags]);
	return args_parse(args, ReleaseArgs);
};

describe('release task flags', () => {
	test('dry-run is the default', () => {
		const parsed = parse_task_flags('scripts/release.task.ts', []);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.value.wetrun, false);
	});

	test('--wetrun reaches the task', () => {
		const parsed = parse_task_flags('scripts/release.task.ts', ['--wetrun']);
		assert.ok(parsed.ok);
		assert.strictEqual(parsed.value.wetrun, true);
	});

	test('an unknown flag is refused, so a misspelled --wetrun is never a silent dry run', () => {
		const parsed = parse_task_flags('scripts/release.task.ts', ['--wet-run']);
		assert.ok(!parsed.ok);
	});
});

describe('npm package generation', () => {
	test('strips stream.ts to JavaScript', async () => {
		const stream_ts = await fs.project.read_text(NPM_PACKAGE_SOURCES.stream_ts);
		const stream_js = strip_stream_types(stream_ts);
		assert.match(stream_js, /export function make_stream_functions\(\s*Hasher,\s*check\s*\)/);
		assert.doesNotMatch(stream_js, /import type|export interface/);
	});

	test('refuses TypeScript the transforms do not know', () => {
		assert.throws(() => strip_stream_types('const x: Uint8Array = y;\n'), /TypeScript syntax/);
	});

	test('finds the main JS file and derives the package files', () => {
		assert.deepStrictEqual(
			to_wasm_pack_files(['index.js', 'blake3_wasm_small_bg.wasm', 'blake3_wasm_small.js']),
			{
				main_js: 'blake3_wasm_small.js',
				dts_file: 'blake3_wasm_small.d.ts',
				wasm_file: 'blake3_wasm_small_bg.wasm',
				pkg_name: '@fuzdev/blake3-wasm-small',
				is_small: true
			}
		);
		assert.strictEqual(to_wasm_pack_files(['index.js', 'browser.js', 'x_bg.js']), null);
	});

	test('the npm README stops at Architecture and names the small package', async () => {
		const readme = await fs.project.read_text(NPM_PACKAGE_SOURCES.readme);
		const files = to_wasm_pack_files(['blake3_wasm_small.js'])!;
		const npm_readme = render_npm_readme(readme, files);
		assert.ok(npm_readme.startsWith('# @fuzdev/blake3-wasm-small\n'));
		assert.doesNotMatch(npm_readme, /## Architecture|## Building from source/);
		assert.doesNotMatch(npm_readme, /from '@fuzdev\/blake3-wasm'/);
		assert.throws(() => render_npm_readme('# blake3\n', files), /Architecture/);
	});
});

describe('npm package patch', () => {
	const list_names = async (dir: FsDir): Promise<Array<string>> => {
		const names: Array<string> = [];
		for await (const entry of dir.list()) names.push(entry.name);
		return names.sort();
	};

	test('a package without package.json is refused before anything is written', async () => {
		await using pkg_dir = await fs.temp_dir('blake3-patch-');
		await pkg_dir.write('blake3_wasm.js', '');
		await assert.rejects(
			patch_npm_package({ pkg_dir, project: fs.project.readonly(), log: () => {} }),
			/no package\.json/
		);
		assert.deepStrictEqual(await list_names(pkg_dir), ['blake3_wasm.js']);
	});

	test('an invalid package.json is refused before anything is written', async () => {
		await using pkg_dir = await fs.temp_dir('blake3-patch-');
		await pkg_dir.write('blake3_wasm.js', '');
		await pkg_dir.write('package.json', '{');
		await assert.rejects(
			patch_npm_package({ pkg_dir, project: fs.project.readonly(), log: () => {} }),
			/invalid package\.json/
		);
		assert.deepStrictEqual(await list_names(pkg_dir), ['blake3_wasm.js', 'package.json']);
		assert.strictEqual(await pkg_dir.read_text('package.json'), '{');
	});

	test('a package.json that is not an object is refused before anything is written', async () => {
		await using pkg_dir = await fs.temp_dir('blake3-patch-');
		await pkg_dir.write('blake3_wasm.js', '');
		await pkg_dir.write('package.json', '[]');
		await assert.rejects(
			patch_npm_package({ pkg_dir, project: fs.project.readonly(), log: () => {} }),
			/not an object/
		);
		assert.deepStrictEqual(await list_names(pkg_dir), ['blake3_wasm.js', 'package.json']);
	});
});

describe('wasm size validation', () => {
	test('a package that is not built fails, rather than skipping', async () => {
		await using dir = await fs.temp_dir('blake3-size-');
		const report = await validate_wasm_size(dir.readonly());
		assert.strictEqual(report.passed, 0);
		assert.ok(report.failed > 0);
		assert.ok(report.lines.some((line) => line.includes('not built')));
	});

	test('built packages in range pass', async () => {
		await using dir = await fs.temp_dir('blake3-size-');
		const packages = [
			{ dir: 'crates/blake3_wasm/pkg', wasm: 'blake3_wasm_bg.wasm', bytes: 45_000 },
			{ dir: 'crates/blake3_wasm_small/pkg', wasm: 'blake3_wasm_small_bg.wasm', bytes: 32_000 }
		];
		for (const p of packages) {
			await dir.mkdir(p.dir, { recursive: true });
			await dir.write(`${p.dir}/${p.wasm}`, new Uint8Array(p.bytes));
			for (const file of ['index.js', 'browser.js', 'stream.js', 'index.d.ts']) {
				await dir.write(`${p.dir}/${file}`, '');
			}
			for (const file of ['package.json', 'README.md', 'LICENSE']) {
				await dir.write(`${p.dir}/${file}`, '');
			}
		}
		const report = await validate_wasm_size(dir.readonly());
		assert.strictEqual(report.failed, 0, report.lines.join('\n'));
	});
});

const stats = (mean_ns: number) => ({
	mean_ns,
	ops_per_second: 1e9 / mean_ns,
	std_dev_ns: mean_ns / 100,
	sample_size: 1000,
	confidence_interval_ns: [mean_ns * 0.99, mean_ns * 1.01] as [number, number],
	p50_ns: mean_ns,
	p75_ns: mean_ns,
	p90_ns: mean_ns,
	p95_ns: mean_ns,
	p99_ns: mean_ns,
	min_ns: mean_ns,
	max_ns: mean_ns
});

const make_result = (runtime: string, mean_ns: number): BenchSuiteResult => ({
	runtime,
	timestamp: '2026-01-01T00:00:00.000Z',
	groups: [
		{
			name: 'hash (1 KB)',
			data_bytes: 1024,
			results: [
				{ name: 'blake3_wasm', category: 'blake3', stats: stats(mean_ns) },
				{ name: 'blake3_wasm_small', category: 'blake3', stats: stats(mean_ns * 2) }
			]
		}
	],
	wasm_sizes: [{ label: 'blake3_wasm', bytes: 45_000 }],
	runner_categories: { blake3_wasm: 'blake3', blake3_wasm_small: 'blake3' }
});

describe('bench results', () => {
	test('a well-formed result validates', () => {
		assert.deepStrictEqual(validate_bench_result(make_result('Node.js', 1000)), []);
	});

	test('drift is reported by path', () => {
		const result: Record<string, unknown> = { ...make_result('Node.js', 1000), extra: 1 };
		delete result.timestamp;
		assert.deepStrictEqual(validate_bench_result(result), [
			'timestamp: expected string, got undefined',
			'(root): unexpected fields: extra'
		]);
	});

	test('a significant slowdown past the threshold is a regression', () => {
		const base = { path: 'base.json', result: make_result('Node.js', 1000) };
		const slower = { path: 'current.json', result: make_result('Node.js', 1500) };
		assert.strictEqual(render_diff(base, slower, 5).regressions, 2);
		assert.strictEqual(render_diff(base, base, 5).regressions, 0);
	});

	test('the markdown report is aligned and dated as given', () => {
		const { markdown } = render_report([make_result('Deno', 1200), make_result('Node.js', 1000)], {
			date: '2026-01-02'
		});
		assert.match(markdown, /^\*\*Date:\*\* 2026-01-02$/m);
		assert.strictEqual(align_markdown_tables(markdown), markdown);
	});
});

describe('markdown tables', () => {
	test('pads columns to the widest cell, by alignment', () => {
		const table = ['| a | bb |', '| --- | ---: |', '| ccc | d |', ''].join('\n');
		assert.strictEqual(
			align_markdown_tables(table),
			['| a   | bb |', '| --- | -: |', '| ccc |  d |', ''].join('\n')
		);
	});

	test('narrow columns keep the minimum widths deno fmt gives each alignment', () => {
		const table = ['| a | b | c | d |', '| --- | :-: | :-- | --: |', '| x | x | x | x |', ''].join(
			'\n'
		);
		assert.strictEqual(
			align_markdown_tables(table),
			['| a |  b  | c  |  d |', '| - | :-: | :- | -: |', '| x |  x  | x  |  x |', ''].join('\n')
		);
	});

	test('leaves a run of pipe lines without a separator row as written', () => {
		const text = '| not | a table |\n| still | not |';
		assert.strictEqual(align_markdown_tables(text), text);
	});

	test('the committed report is already aligned', async () => {
		const report = await fs.project.read_text('benches/results/report.md');
		assert.strictEqual(align_markdown_tables(report), report);
	});
});

/** A finished captured call, exited with `code`. */
const output = (code: number, stdout = '', stderr = ''): SpawnOutput => ({
	kind: 'exited',
	code,
	stdout,
	stderr,
	truncated: false
});

const exited = (code: number): SpawnResult => ({ kind: 'exited', code });

interface FakeCall {
	program: string;
	args: ReadonlyArray<string>;
	cwd?: string;
}

interface FakeReleaseOptions {
	status?: string;
	/** What `changeset version` bumps `package.json` to. */
	bump_to?: string;
	published?: ReadonlyArray<string>;
	/** The version the fake build stamps, the project's when absent. */
	built_version?: string;
	/** A package directory whose `npm publish` fails. */
	publish_fails?: string;
	/** Whether `npm view` fails for a reason other than `E404`. */
	view_fails?: boolean;
	/** Whether `npm view` answers an unpublished version with empty output, not `E404`. */
	view_empty?: boolean;
	/** Whether `npm whoami` fails. */
	logged_out?: boolean;
	/** The name the fake build stamps on the second package, its own when absent. */
	built_name?: string;
}

/**
 * Fake programs over a temp project: `npm run build:wasm` writes the built packages'
 * `package.json` at the project's version, and `changeset version` bumps it.
 */
const create_fake_release = (project: FsDir, options: FakeReleaseOptions = {}) => {
	const calls: Array<FakeCall> = [];
	const record = (program: string, args: ReadonlyArray<string>, call?: SpawnCallOptions) => {
		const cwd = call?.cwd?.path;
		calls.push(cwd === undefined ? { program, args } : { program, args, cwd });
	};
	const read_version = async (): Promise<string> =>
		JSON.parse(await project.read_text('package.json')).version;
	const deps = {
		project,
		git: {
			out: async (args: ReadonlyArray<string>) => {
				record('git', args);
				if (args[0] === 'branch') return output(0, 'main\n');
				return output(0, options.status ?? '');
			}
		},
		npm: {
			out: async (args: ReadonlyArray<string>, call?: SpawnCallOptions) => {
				record('npm', args, call);
				if (args[0] === 'whoami') {
					return options.logged_out
						? output(1, '', 'npm error code ENEEDAUTH')
						: output(0, 'someone\n');
				}
				if (args[0] === 'view') {
					if (options.view_fails) return output(1, '', 'npm error code ETIMEDOUT');
					const published = options.published?.includes(args[1]!);
					if (published) return output(0, `${(args[1] ?? '').split('@').at(-1)}\n`);
					return options.view_empty ? output(0, '') : output(1, '', 'E404');
				}
				return output(0, '', 'npm notice tarball');
			},
			run: async (args: ReadonlyArray<string>, call?: SpawnCallOptions) => {
				record('npm', args, call);
				if (args[0] === 'publish' && call?.cwd?.path.endsWith(options.publish_fails ?? '\0')) {
					return exited(1);
				}
				if (args[0] === 'run' && args[1] === 'build:wasm') {
					const version = options.built_version ?? (await read_version());
					for (const [i, { name, dir }] of RELEASE_PACKAGES.entries()) {
						const built_name = i === 1 ? (options.built_name ?? name) : name;
						await project.mkdir(dir, { recursive: true });
						await project.write(
							`${dir}/package.json`,
							JSON.stringify({ name: built_name, version })
						);
					}
				}
				return exited(0);
			}
		},
		changeset: {
			path: '/fake/changeset',
			run: async (args: ReadonlyArray<string>) => {
				record('changeset', args);
				if (options.bump_to) {
					const pkg = JSON.parse(await project.read_text('package.json'));
					await project.write('package.json', JSON.stringify({ ...pkg, version: options.bump_to }));
				}
				return exited(0);
			}
		},
		log: { info: () => {}, warn: () => {} }
	};
	return { deps, calls };
};

const write_release_project = async (
	project: FsDir,
	{ pending = true, cargo_version = '0.2.0' } = {}
) => {
	await project.write('package.json', JSON.stringify({ name: '@fuzdev/blake3', version: '0.2.0' }));
	await project.write(
		'Cargo.toml',
		`[workspace.package]\nversion = "${cargo_version}"\n\n[workspace.dependencies]\nblake3 = { version = "1.8" }\n`
	);
	await project.mkdir('.changeset');
	if (pending)
		await project.write('.changeset/some-change.md', '---\n"@fuzdev/blake3": minor\n---\n');
};

const scripts_run = (calls: ReadonlyArray<FakeCall>) =>
	calls.filter((c) => c.program === 'npm' && c.args[0] === 'run').map((c) => c.args[1]);

describe('release pipeline, against fakes', () => {
	test('a dry-run validates and packs, and changes nothing', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project);
		await run_release(deps, { wetrun: false });

		assert.deepStrictEqual(scripts_run(calls), ['check', 'build:wasm', ...RELEASE_VALIDATIONS]);
		assert.ok(!calls.some((c) => c.program === 'changeset'));
		assert.ok(!calls.some((c) => c.args[0] === 'whoami'));
		const publishes = calls.filter((c) => c.args[0] === 'publish');
		assert.deepStrictEqual(
			publishes.map((c) => [c.args.join(' '), c.cwd]),
			RELEASE_PACKAGES.map((p) => ['publish --dry-run --access public', `${project.path}/${p.dir}`])
		);
		assert.match(await project.read_text('Cargo.toml'), /^version = "0.2.0"$/m);
		assert.strictEqual(await project.exists(RELEASE_SENTINEL_PATH), false);
	});

	test('a wetrun refuses an unclean tree before running anything', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, { status: ' M README.md' });
		await assert.rejects(run_release(deps, { wetrun: true }), /uncommitted changes/);
		assert.deepStrictEqual(scripts_run(calls), []);
		assert.ok(!calls.some((c) => c.program === 'changeset'));
	});

	test('a wetrun bumps, syncs Cargo.toml, publishes both, and clears the sentinel', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, { bump_to: '0.3.0' });
		await run_release(deps, { wetrun: true });

		assert.deepStrictEqual(scripts_run(calls), ['check', 'build:wasm', ...RELEASE_VALIDATIONS]);
		assert.ok(calls.some((c) => c.program === 'changeset' && c.args[0] === 'version'));
		const cargo = await project.read_text('Cargo.toml');
		assert.match(cargo, /^\[workspace\.package\]\nversion = "0.3.0"$/m);
		assert.match(cargo, /blake3 = \{ version = "1.8" \}/);
		const publishes = calls.filter((c) => c.args[0] === 'publish').map((c) => c.args.join(' '));
		assert.deepStrictEqual(publishes, ['publish --access public', 'publish --access public']);
		assert.strictEqual(await project.exists(RELEASE_SENTINEL_PATH), false);
	});

	test('a retry resumes from the sentinel and skips what is published', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project, { pending: false });
		await project.write(RELEASE_SENTINEL_PATH, '0.2.0');
		const { deps, calls } = create_fake_release(project, {
			status: ' M package.json',
			published: ['@fuzdev/blake3-wasm@0.2.0']
		});
		await run_release(deps, { wetrun: true });

		assert.ok(!calls.some((c) => c.program === 'changeset'));
		assert.ok(!calls.some((c) => c.program === 'git' && c.args[0] === 'status'));
		const publishes = calls.filter((c) => c.args[0] === 'publish');
		assert.deepStrictEqual(
			publishes.map((c) => c.cwd),
			[`${project.path}/crates/blake3_wasm_small/pkg`]
		);
		assert.strictEqual(await project.exists(RELEASE_SENTINEL_PATH), false);
	});

	test('a wetrun with nothing to bump and no sentinel fails before building', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project, { pending: false });
		const { deps, calls } = create_fake_release(project);
		await assert.rejects(run_release(deps, { wetrun: true }), /no pending changesets/);
		assert.deepStrictEqual(scripts_run(calls), []);
	});

	test('a dry-run leaves an out-of-sync Cargo.toml as it is', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project, { cargo_version: '0.1.0' });
		const { deps } = create_fake_release(project);
		await run_release(deps, { wetrun: false });
		assert.match(await project.read_text('Cargo.toml'), /^version = "0.1.0"$/m);
	});

	test('a wetrun checks auth, bumps, validates, then publishes, in that order', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, { bump_to: '0.3.0' });
		await run_release(deps, { wetrun: true });
		const index_of = (predicate: (call: FakeCall) => boolean): number => {
			const index = calls.findIndex(predicate);
			assert.notStrictEqual(index, -1);
			return index;
		};
		const whoami = index_of((c) => c.args[0] === 'whoami');
		const bump = index_of((c) => c.program === 'changeset');
		const last_validation = index_of((c) => c.args[1] === RELEASE_VALIDATIONS.at(-1));
		const first_publish = index_of((c) => c.args[0] === 'publish');
		assert.ok(whoami < bump && bump < last_validation && last_validation < first_publish);
	});

	test('a failed publish stops there and keeps the sentinel at the bumped version', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, {
			bump_to: '0.3.0',
			publish_fails: RELEASE_PACKAGES[0]!.dir
		});
		await assert.rejects(run_release(deps, { wetrun: true }), /npm publish .* failed/);
		assert.deepStrictEqual(
			calls.filter((c) => c.args[0] === 'publish').map((c) => c.cwd),
			[`${project.path}/${RELEASE_PACKAGES[0]!.dir}`]
		);
		assert.strictEqual((await project.read_text(RELEASE_SENTINEL_PATH)).trim(), '0.3.0');
	});

	test('a stale sentinel still gets the cleanliness check, and is replaced by a bump', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		await project.write(RELEASE_SENTINEL_PATH, '0.1.0');
		const dirty = create_fake_release(project, { status: ' M README.md', bump_to: '0.3.0' });
		await assert.rejects(run_release(dirty.deps, { wetrun: true }), /uncommitted changes/);
		const { deps, calls } = create_fake_release(project, { bump_to: '0.3.0' });
		await run_release(deps, { wetrun: true });
		assert.ok(calls.some((c) => c.program === 'changeset'));
		assert.strictEqual(await project.exists(RELEASE_SENTINEL_PATH), false);
	});

	test('a dry-run leaves a retry sentinel in place and still checks the tree', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project, { pending: false });
		await project.write(RELEASE_SENTINEL_PATH, '0.2.0');
		const { deps, calls } = create_fake_release(project);
		await run_release(deps, { wetrun: false });
		assert.strictEqual((await project.read_text(RELEASE_SENTINEL_PATH)).trim(), '0.2.0');
		assert.ok(calls.some((c) => c.program === 'git' && c.args[0] === 'status'));
	});

	test('a version the registry answers with empty output is published', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, { bump_to: '0.3.0', view_empty: true });
		await run_release(deps, { wetrun: true });
		assert.strictEqual(
			calls.filter((c) => c.args[0] === 'publish').length,
			RELEASE_PACKAGES.length
		);
	});

	test('a wetrun logged out of npm fails before bumping', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, { bump_to: '0.3.0', logged_out: true });
		await assert.rejects(run_release(deps, { wetrun: true }), /not logged in/);
		assert.ok(!calls.some((c) => c.program === 'changeset'));
	});

	test('a build under another package name publishes nothing', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, {
			bump_to: '0.3.0',
			built_name: 'blake3_wasm_small'
		});
		await assert.rejects(run_release(deps, { wetrun: true }), /built as blake3_wasm_small/);
		assert.ok(!calls.some((c) => c.args[0] === 'publish'));
	});

	test('a build at another version publishes nothing', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, {
			bump_to: '0.3.0',
			built_version: '0.2.0'
		});
		await assert.rejects(
			run_release(deps, { wetrun: true }),
			/built at v0\.2\.0, expected v0\.3\.0/
		);
		assert.ok(!calls.some((c) => c.args[0] === 'publish'));
	});

	test('a registry lookup that fails, other than E404, publishes nothing', async () => {
		await using project = await fs.temp_dir('blake3-release-');
		await write_release_project(project);
		const { deps, calls } = create_fake_release(project, { bump_to: '0.3.0', view_fails: true });
		await assert.rejects(run_release(deps, { wetrun: true }), /npm view .* failed/);
		assert.ok(!calls.some((c) => c.args[0] === 'publish'));
	});
});
