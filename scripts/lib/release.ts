/**
 * The release pipeline for `@fuzdev/blake3-wasm` and `@fuzdev/blake3-wasm-small`.
 *
 * Dry-run by default: it runs every check, build, and validation and packs both packages
 * with `npm publish --dry-run`, leaving the version and the workspace alone.
 * With `wetrun` it bumps the version with `changeset version`, syncs it to `Cargo.toml`,
 * and publishes to npm, skipping a package already published at that version, so a
 * failed run can be retried. A sentinel file written after the bump marks a wetrun in
 * progress, so a retry resumes from the bumped version instead of bumping again.
 *
 * A wetrun refuses to start off `main`, with `HEAD` not at the freshly fetched `origin/main`,
 * or with uncommitted changes (on a retry, any outside the release files), so the
 * published packages are built from the commit the finalize tags and pushes.
 * A dry-run warns about each instead.
 *
 * @module
 */

import type { FsDir } from '@fuzdev/gro/fs.ts';
import type { SpawnOutput, SpawnProgram, SpawnResult } from '@fuzdev/gro/spawn.ts';
import { TaskError } from '@fuzdev/gro/task.ts';

/** Marks a wetrun between its version bump and its last publish, for retry detection. */
export const RELEASE_SENTINEL_PATH = '.changeset/.release-in-progress';

/** The published packages and their build output directories. */
export const RELEASE_PACKAGES: ReadonlyArray<{ name: string; dir: string }> = [
	{ name: '@fuzdev/blake3-wasm', dir: 'crates/blake3_wasm/pkg' },
	{ name: '@fuzdev/blake3-wasm-small', dir: 'crates/blake3_wasm_small/pkg' }
];

/**
 * The files a release changes (`changeset version` and the version sync), so the scoped
 * `git add` that finalizes it keeps stray working-tree changes out of the release commit.
 */
export const RELEASE_FILES: ReadonlyArray<string> = [
	'package.json',
	'CHANGELOG.md',
	'Cargo.toml',
	'Cargo.lock',
	'.changeset'
];

/** The remote and branch a release publishes from, which the tag is pushed to. */
export const RELEASE_REMOTE = 'origin';
export const RELEASE_BRANCH = 'main';

/**
 * Whether a working-tree path is one of `RELEASE_FILES` or inside one of them.
 * @param path - repo-relative, as `git status --porcelain` prints it
 */
export const is_release_file = (path: string): boolean =>
	RELEASE_FILES.some((file) => path === file || path.startsWith(`${file}/`));

/**
 * The paths in `git status --porcelain` output that aren't release files,
 * both sides of a rename included.
 */
export const to_non_release_changes = (porcelain: string): Array<string> =>
	porcelain
		.split('\n')
		.filter((line) => line.trim())
		.flatMap((line) => line.slice(3).split(' -> '))
		.filter((path) => !is_release_file(path));

/**
 * The validations after the build, run against the built packages without rebuilding.
 * The WASI component isn't published, so its tests aren't among them.
 */
export const RELEASE_VALIDATIONS: ReadonlyArray<string> = [
	'validate:npm',
	'validate:size',
	'test:wasm',
	'test:wasm:small'
];

// matches the version under `[workspace.package]`, not a dependency's
const CARGO_WORKSPACE_VERSION = /(\[workspace\.package\][\s\S]*?^version\s*=\s*)"([^"]*)"/m;

export interface ReleaseLog {
	info: (message: string) => void;
	warn: (message: string) => void;
}

export interface ReleaseDeps {
	/** The repo, holding `package.json`, `Cargo.toml`, `.changeset/`, and the built packages. */
	project: FsDir;
	/**
	 * Reads the local repo (the branch, the working tree's status, the commits) and fetches
	 * the release branch, which may prompt, so it needs the user's credentials.
	 */
	git: Pick<SpawnProgram, 'out' | 'run'>;
	/** Runs the package scripts, and checks auth, the registry, and publishes. */
	npm: Pick<SpawnProgram, 'out' | 'run'>;
	/** The changesets CLI, `null` when it isn't installed. */
	changeset: Pick<SpawnProgram, 'run' | 'path'> | null;
	log: ReleaseLog;
}

export interface ReleaseOptions {
	/** Bump, sync, and publish, rather than only validate. */
	wetrun: boolean;
}

const is_ok = (result: SpawnResult): boolean => result.kind === 'exited' && result.code === 0;

const to_result_message = (result: SpawnResult): string =>
	result.kind === 'exited'
		? `exit code ${result.code}`
		: result.kind === 'signaled'
			? `signal ${result.signal}`
			: result.kind;

/** Whether a captured call exited 0 with all of its output. */
const is_complete = (output: SpawnOutput): boolean => is_ok(output) && !output.truncated;

/**
 * Runs the pipeline. Each step's failure throws, so a later step never runs past one.
 * @throws `TaskError` - naming the step that failed and how to recover where there's a way
 */
export const run_release = async (deps: ReleaseDeps, { wetrun }: ReleaseOptions): Promise<void> => {
	const { project, git, npm, changeset, log } = deps;

	const run_script = async (script: string): Promise<void> => {
		const result = await npm.run(['run', script]);
		if (!is_ok(result)) {
			throw new TaskError(`npm run ${script} failed (${to_result_message(result)})`);
		}
	};

	log.info(`=== blake3 release ${wetrun ? '(wetrun)' : '(dry-run)'} ===`);

	log.info('=== Step 1: Preflight checks ===');
	if (!changeset) {
		throw new TaskError('changeset CLI not found: install it with `npm i -g @changesets/cli`');
	}
	log.info(`  changeset CLI: ${changeset.path}`);
	// the root package is private, which changesets skips unless the config opts it in
	// (the default was `true` before changesets 3), so a wetrun would bump nothing
	if (!(await versions_private_packages(project))) {
		throw new TaskError(
			'.changeset/config.json must set `"privatePackages": { "version": true, "tag": false }` —\n' +
				'the root package @fuzdev/blake3 is private, and changesets 3 skips private packages by default'
		);
	}

	// a wetrun refuses what a dry-run warns about: the published packages must be built from
	// the commit the tag lands on, and the finalize's push must not fail after the publish
	const refuse_or_warn = (message: string): void => {
		if (wetrun) throw new TaskError(message);
		log.warn(`  ${message} (a wetrun refuses)`);
	};

	const branch = await git.out(['branch', '--show-current']);
	const branch_name = is_complete(branch) ? branch.stdout.trim() : '';
	if (branch_name !== RELEASE_BRANCH) {
		refuse_or_warn(
			`on ${branch_name ? `branch "${branch_name}"` : 'a detached HEAD'} — releases publish from ${RELEASE_BRANCH}`
		);
	}

	const initial_sentinel = await read_sentinel(project);
	const version_before = await read_package_version(project);
	const status = await git.out(['status', '--porcelain']);
	if (!is_complete(status)) {
		throw new TaskError('git status failed — is this a git repository?');
	}
	const uncommitted = status.stdout.trim();
	// a valid retry allows the release files' changes that `changeset version` and the sync
	// left behind, but nothing else, which would be published without reaching the release
	// commit's scoped `git add`; a stale sentinel (another version) gets the full check
	const retry_mode = wetrun && initial_sentinel !== null && initial_sentinel === version_before;
	if (retry_mode) {
		log.info('  Sentinel detected — allowing uncommitted release files (retry mode)');
		// the raw output, since trimming would eat the first line's status column
		const outside = to_non_release_changes(status.stdout);
		if (outside.length) {
			throw new TaskError(
				[
					'refusing to retry with uncommitted changes outside the release files:',
					indent(outside.join('\n')),
					'They would be published but left out of the release commit.',
					`Commit and push them, leaving the release files (${RELEASE_FILES.join(', ')}) uncommitted,`,
					'then re-run `npm run release -- --wetrun`.'
				].join('\n')
			);
		}
	} else if (uncommitted) {
		log.warn(`  uncommitted changes in worktree:\n${indent(uncommitted)}`);
		if (wetrun) throw new TaskError('refusing to publish with uncommitted changes');
		log.warn('  Continuing dry-run anyway...');
	}

	// the tag is pushed after the publish, so HEAD must already be the remote's branch:
	// behind, the push fails with the version on npm; ahead, unpushed commits get released
	log.info(`  Fetching ${RELEASE_REMOTE}/${RELEASE_BRANCH}...`);
	const fetched = await git.run(['fetch', RELEASE_REMOTE, RELEASE_BRANCH]);
	if (is_ok(fetched)) {
		const head = await read_commit(git, 'HEAD');
		const remote = await read_commit(git, `${RELEASE_REMOTE}/${RELEASE_BRANCH}`);
		if (head === null || remote === null) {
			refuse_or_warn(`could not resolve HEAD and ${RELEASE_REMOTE}/${RELEASE_BRANCH}`);
		} else if (head !== remote) {
			refuse_or_warn(
				`HEAD (${head.slice(0, 12)}) is not ${RELEASE_REMOTE}/${RELEASE_BRANCH} (${remote.slice(0, 12)}) — ` +
					'push or pull until they match'
			);
		} else {
			log.info(`  HEAD matches ${RELEASE_REMOTE}/${RELEASE_BRANCH} (${head.slice(0, 12)})`);
		}
	} else {
		refuse_or_warn(
			`git fetch ${RELEASE_REMOTE} ${RELEASE_BRANCH} failed (${to_result_message(fetched)})`
		);
	}

	// auth matters only to a wetrun
	if (wetrun) {
		const whoami = await npm.out(['whoami']);
		if (!is_complete(whoami)) {
			throw new TaskError('not logged in to npm (run `npm login` first)');
		}
		log.info(`  npm authenticated as: ${whoami.stdout.trim()}`);
	}

	let version: string;
	if (wetrun) {
		log.info('=== Step 2: Bump version (changeset version) ===');
		if (initial_sentinel === version_before) {
			log.info(`  Sentinel found at v${version_before} — skipping changeset version (retry)`);
			version = version_before;
		} else {
			if (initial_sentinel !== null) {
				log.warn(`  removing stale sentinel (v${initial_sentinel})`);
				await project.remove(RELEASE_SENTINEL_PATH, { missing_ok: true });
			}
			if (!(await has_pending_changesets(project))) {
				throw new TaskError(
					[
						'no pending changesets and no retry sentinel',
						'A previous wetrun likely consumed the changesets before the sentinel was written.',
						`package.json is at v${version_before}. To resume from this version:`,
						`  echo "${version_before}" > ${RELEASE_SENTINEL_PATH}`,
						'  npm run release -- --wetrun',
						'To start fresh, restore the release files and add a changeset:',
						`  git checkout -- ${RELEASE_FILES.join(' ')} && changeset`
					].join('\n')
				);
			}
			const bumped = await changeset.run(['version']);
			if (!is_ok(bumped)) {
				throw new TaskError(`changeset version failed (${to_result_message(bumped)})`);
			}
			version = await read_package_version(project);
			if (version === version_before) {
				throw new TaskError(
					[
						`version unchanged at ${version} after changeset version`,
						'Changesets were found but none bumped the root package (@fuzdev/blake3),',
						'and `changeset version` may have consumed them. Restore the release files,',
						'check the package name in the .changeset/*.md files, and re-run:',
						`  git checkout -- ${RELEASE_FILES.join(' ')}`
					].join('\n')
				);
			}
			log.info(`  Version bumped: ${version_before} -> ${version}`);
			await project.write(RELEASE_SENTINEL_PATH, version);
			log.info(`  Sentinel written (${RELEASE_SENTINEL_PATH})`);
		}
	} else {
		log.info('=== Step 2: Read version (dry-run) ===');
		version = version_before;
		log.info(`  Current version: ${version}`);
		if (initial_sentinel === version) {
			log.info(`  Sentinel found at v${initial_sentinel} — wetrun will retry from that version`);
		} else {
			if (initial_sentinel !== null) {
				log.warn(`  stale sentinel (v${initial_sentinel}) — wetrun will remove it`);
			}
			if (await has_pending_changesets(project)) {
				log.info('  Pending changesets found — wetrun will bump version');
			} else {
				log.warn('  no pending changesets and no retry sentinel — wetrun would fail');
				log.warn('  Run `changeset` to add one before publishing.');
			}
		}
	}
	if (!/^\d+\.\d+\.\d+/.test(version)) {
		throw new TaskError(`version "${version}" in package.json does not look like semver`);
	}

	log.info('=== Step 3: Sync version ===');
	const cargo = await project.read_text('Cargo.toml');
	const cargo_version = CARGO_WORKSPACE_VERSION.exec(cargo)?.[2];
	if (cargo_version === undefined) {
		throw new TaskError('could not find [workspace.package] version in Cargo.toml');
	}
	if (wetrun) {
		const cargo_updated = cargo.replace(CARGO_WORKSPACE_VERSION, `$1"${version}"`);
		if (cargo_updated === cargo) {
			log.info(`  Cargo.toml already at v${version}`);
		} else {
			await project.write('Cargo.toml', cargo_updated);
			log.info(`  Synced Cargo.toml to v${version}`);
		}
	} else if (cargo_version === version) {
		log.info(`  Cargo.toml: v${version} (ok)`);
	} else {
		log.warn(`  Cargo.toml at v${cargo_version}, wetrun would sync to v${version}`);
	}

	log.info('=== Step 4: Check (typecheck + test + clippy + rustdoc + cargo fmt + tsv format) ===');
	await run_script('check');

	log.info('=== Step 5: Build WASM (all targets) ===');
	await run_script('build:wasm');

	log.info(`=== Step 6: Verify built package names and versions ===`);
	for (const { name, dir } of RELEASE_PACKAGES) {
		const built = JSON.parse(await project.read_text(`${dir}/package.json`));
		if (built.name !== name) {
			throw new TaskError(
				`${dir} built as ${built.name}, expected ${name}\n` +
					'scripts/lib/npm_package.ts sets the npm name (wasm-pack emits the crate name).'
			);
		}
		if (built.version !== version) {
			throw new TaskError(
				`${name} built at v${built.version}, expected v${version}\n` +
					'Cargo.toml version may be out of sync — wetrun syncs it automatically.'
			);
		}
		log.info(`  PASS: ${name} = v${version}`);
	}

	log.info(`=== Step 7: Validate npm packages + WASM sizes + correctness ===`);
	for (const script of RELEASE_VALIDATIONS) await run_script(script);

	log.info('=== Step 8: Publish to npm ===');
	// idempotent: a package already published at this version is skipped, so a retry after a
	// partial publish resumes, and the sentinel stays until every package is published
	for (let i = 0; i < RELEASE_PACKAGES.length; i++) {
		const { name, dir } = RELEASE_PACKAGES[i]!;
		const cwd = project.dir(dir);
		if (wetrun) {
			if (await is_published(npm, name, version)) {
				log.info(`  SKIP: ${name}@${version} already published`);
				continue;
			}
			log.info(`  Publishing ${name}...`);
			const result = await npm.run(['publish', '--access', 'public'], { cwd });
			if (!is_ok(result)) {
				const remaining = RELEASE_PACKAGES.slice(i)
					.map((p) => `    cd ${p.dir} && npm publish --access public`)
					.join('\n');
				throw new TaskError(
					`npm publish ${name} failed (${to_result_message(result)})\n` +
						'  Packages not published — re-run `npm run release -- --wetrun` to retry, ' +
						`or publish manually:\n${remaining}`
				);
			}
			log.info(`  Published ${name}@${version}`);
		} else {
			log.info(`  [dry-run] ${name}:`);
			const result = await npm.out(['publish', '--dry-run', '--access', 'public'], { cwd });
			// npm prints the tarball notice to stderr
			const stderr = result.stderr.trim();
			if (stderr) log.info(stderr);
			if (is_complete(result)) {
				log.info(`  PASS: ${name} packs cleanly`);
			} else if (/cannot publish over|previously published version/i.test(stderr)) {
				// a dry-run never bumps, so between releases it packs the current, already-published
				// version, which a wetrun would have bumped first
				log.info(
					`  PASS: ${name} packs cleanly (v${version} already published — a wetrun publishes the bumped version)`
				);
			} else {
				const stdout = result.stdout.trim();
				throw new TaskError(
					`npm publish --dry-run ${name} failed (${to_result_message(result)})` +
						(stdout ? `\n${stdout}` : '')
				);
			}
		}
	}

	// every package is published, so a retry has nothing left to resume
	if (wetrun) await project.remove(RELEASE_SENTINEL_PATH, { missing_ok: true });

	log.info('=== Done ===');
	if (wetrun) {
		for (const { name } of RELEASE_PACKAGES) log.info(`  Published ${name}@${version} to npm`);
	} else {
		log.info(`  Dry-run complete for v${version} — all checks passed.`);
		log.info('  Run with --wetrun to publish to npm.');
	}
	const tag = wetrun ? `v${version}` : 'v<new_version>';
	log.info(
		[
			wetrun
				? '  Git commands to finalize the release (scoped add; annotated tag —'
				: '  After wetrun, finalize with (scoped add; annotated tag —',
			'  `git push --follow-tags` ignores lightweight tags):',
			'',
			`    git add -- ${RELEASE_FILES.join(' ')}`,
			`    git commit -m "${tag}"`,
			`    git tag -m ${tag} ${tag}`,
			'    git push --follow-tags'
		].join('\n')
	);
};

const indent = (text: string): string =>
	text
		.split('\n')
		.map((line) => `    ${line}`)
		.join('\n');

/** The full hash `rev` resolves to, `null` when git can't resolve it. */
const read_commit = async (git: Pick<SpawnProgram, 'out'>, rev: string): Promise<string | null> => {
	const result = await git.out(['rev-parse', '--verify', '--end-of-options', `${rev}^{commit}`]);
	return is_complete(result) ? result.stdout.trim() || null : null;
};

/** Whether `.changeset/config.json` has changesets version private packages, as the root is. */
const versions_private_packages = async (project: FsDir): Promise<boolean> => {
	const text = await project.read_text_if_exists('.changeset/config.json');
	if (text === null) return false;
	const { privatePackages } = JSON.parse(text);
	return privatePackages === true || privatePackages?.version === true;
};

const read_package_version = async (project: FsDir): Promise<string> =>
	JSON.parse(await project.read_text('package.json')).version;

const read_sentinel = async (project: FsDir): Promise<string | null> =>
	(await project.read_text_if_exists(RELEASE_SENTINEL_PATH))?.trim() ?? null;

const has_pending_changesets = async (project: FsDir): Promise<boolean> => {
	if ((await project.stat('.changeset'))?.kind !== 'directory') return false;
	for await (const entry of project.list('.changeset')) {
		if (entry.kind === 'file' && entry.name.endsWith('.md') && entry.name !== 'README.md') {
			return true;
		}
	}
	return false;
};

/**
 * Whether `name@version` is on the registry. Tells "not published" (npm's `E404`) from an
 * npm or network failure, which throws, since no publish decision is safe without an answer.
 * @throws `TaskError` - if `npm view` fails for any reason but `E404`
 */
const is_published = async (
	npm: Pick<SpawnProgram, 'out'>,
	name: string,
	version: string
): Promise<boolean> => {
	const result = await npm.out(['view', `${name}@${version}`, 'version']);
	if (is_complete(result)) return result.stdout.trim() === version;
	const stderr = result.stderr.trim();
	if (stderr.includes('E404')) return false;
	throw new TaskError(`npm view ${name}@${version} failed:\n${stderr}`);
};
