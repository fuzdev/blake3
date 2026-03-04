/**
 * Publish script for @fuzdev/blake3_wasm and @fuzdev/blake3_wasm_small.
 *
 * Dry-run by default — runs all validation but does not mutate the workspace.
 * Pass `--wetrun` to bump version, build, validate, and publish to npm.
 *
 * Usage:
 *   deno task publish              # dry-run (validate everything, no version bump)
 *   deno task publish --wetrun     # changeset version + sync + check + build + validate + publish
 *
 * @module
 */

const wetrun = Deno.args.includes('--wetrun');

const SENTINEL_PATH = '.changeset/.publish-in-progress';

const dec = new TextDecoder();

const web_packages = [
	{ label: '@fuzdev/blake3_wasm', dir: 'crates/blake3_wasm/pkg/web' },
	{ label: '@fuzdev/blake3_wasm_small', dir: 'crates/blake3_wasm_small/pkg/web' },
];

console.log(`\n=== blake3 publish ${wetrun ? '(wetrun)' : '(dry-run)'} ===\n`);

// Step 1: Preflight checks

console.log('=== Step 1: Preflight checks ===');

// Find changeset CLI
const changeset_cli = find_changeset_cli();
if (!changeset_cli) {
	console.error('  FAIL: changeset CLI not found');
	console.error('  Install: npm i -g @changesets/cli');
	Deno.exit(1);
}
console.log(`  changeset CLI: ${changeset_cli}`);

// Check for uncommitted changes — skip in wetrun retry mode (changeset version left changes behind)
const initial_sentinel = read_sentinel();
const version_before = wetrun
	? (JSON.parse(Deno.readTextFileSync('package.json')).version as string)
	: '';
// Only skip the git check for a *valid* retry — stale sentinels (wrong version) still need the check
const retry_mode = wetrun && initial_sentinel !== null && initial_sentinel === version_before;
if (retry_mode) {
	console.log('  Sentinel detected — skipping git cleanliness check (retry mode)');
} else {
	const git_status = new Deno.Command('git', {
		args: ['status', '--porcelain'],
		stdout: 'piped',
		stderr: 'piped',
	}).outputSync();
	if (!git_status.success) {
		console.error('  FAIL: git status failed — is this a git repository?');
		Deno.exit(1);
	}
	const uncommitted = dec.decode(git_status.stdout).trim();
	if (uncommitted) {
		console.warn('  WARN: uncommitted changes in worktree:');
		for (const line of uncommitted.split('\n')) {
			console.warn(`    ${line}`);
		}
		if (wetrun) {
			console.error('  FAIL: refusing to publish with uncommitted changes');
			Deno.exit(1);
		}
		console.warn('  Continuing dry-run anyway...');
	}
}

// Check npm auth (only for wetrun — no point failing dry-runs over auth)
if (wetrun) {
	const whoami = new Deno.Command('npm', {
		args: ['whoami'],
		stdout: 'piped',
		stderr: 'piped',
	}).outputSync();
	if (whoami.success) {
		const user = dec.decode(whoami.stdout).trim();
		console.log(`  npm authenticated as: ${user}`);
	} else {
		console.error('  FAIL: not logged in to npm (run `npm login` first)');
		Deno.exit(1);
	}
}

// Step 2: Bump version

let version: string;

if (wetrun) {
	console.log('\n=== Step 2: Bump version (changeset version) ===');

	if (initial_sentinel === version_before) {
		// Retry detected: changeset version already ran and wrote the sentinel
		console.log(`  Sentinel found at v${version_before} — skipping changeset version (retry)`);
		version = version_before;
	} else {
		if (initial_sentinel !== null) {
			// Stale sentinel from a previous version — remove and proceed
			console.warn(`  WARN: removing stale sentinel (v${initial_sentinel})`);
			Deno.removeSync(SENTINEL_PATH);
		}
		if (has_pending_changesets()) {
			run('changeset version', changeset_cli, ['version']);
			const pkg_after = JSON.parse(Deno.readTextFileSync('package.json'));
			version = pkg_after.version;
			if (version === version_before) {
				console.error(`  FAIL: version unchanged at ${version} after changeset version`);
				console.error(
					'  Changesets were found but none bumped the root package (@fuzdev/blake3).',
				);
				console.error(
					'  Check that your .changeset/*.md files reference the correct package name.',
				);
				Deno.exit(1);
			}
			console.log(`  Version bumped: ${version_before} -> ${version}`);
			// Write sentinel so a retry can skip the version bump
			Deno.writeTextFileSync(SENTINEL_PATH, version);
			console.log(`  Sentinel written (${SENTINEL_PATH})`);
		} else {
			console.error('  FAIL: no pending changesets and no retry sentinel');
			console.error(
				'  A previous wetrun likely consumed the changesets before the sentinel was written.',
			);
			console.error(`  package.json is at v${version_before}. To resume from this version:`);
			console.error(`    echo "${version_before}" > ${SENTINEL_PATH}`);
			console.error('    deno task publish --wetrun');
			console.error('  To start fresh: git checkout . && changeset');
			Deno.exit(1);
		}
	}
} else {
	console.log('\n=== Step 2: Read version (dry-run) ===');
	const pkg = JSON.parse(Deno.readTextFileSync('package.json'));
	version = pkg.version;
	console.log(`  Current version: ${version}`);
	if (has_pending_changesets()) {
		console.log('  Pending changesets found — wetrun will bump version');
	} else if (initial_sentinel !== null) {
		console.log(`  Sentinel found at v${initial_sentinel} — wetrun will retry from that version`);
	} else {
		console.warn('  WARN: no pending changesets and no sentinel — wetrun would fail');
		console.warn('  Run `changeset` to add one before publishing.');
	}
}

if (!/^\d+\.\d+\.\d+/.test(version)) {
	console.error(`  FAIL: version "${version}" in package.json does not look like semver`);
	Deno.exit(1);
}

// Step 3: Sync version

console.log('\n=== Step 3: Sync version ===');

const cargo_path = 'Cargo.toml';
const cargo = Deno.readTextFileSync(cargo_path);
// Match version under [workspace.package] to avoid clobbering dependency versions
const workspace_pkg_re = /(\[workspace\.package\][\s\S]*?^version\s*=\s*)"([^"]*)"/m;
if (!workspace_pkg_re.test(cargo)) {
	console.error('  FAIL: could not find [workspace.package] version in Cargo.toml');
	Deno.exit(1);
}
if (wetrun) {
	const cargo_updated = cargo.replace(workspace_pkg_re, `$1"${version}"`);
	if (cargo_updated === cargo) {
		console.log(`  Cargo.toml already at v${version}`);
	} else {
		Deno.writeTextFileSync(cargo_path, cargo_updated);
		console.log(`  Synced Cargo.toml to v${version}`);
	}
} else {
	const current = read_cargo_version();
	if (current === version) {
		console.log(`  Cargo.toml: v${version} (ok)`);
	} else {
		console.warn(`  WARN: Cargo.toml at v${current}, wetrun would sync to v${version}`);
	}
}

const jsr_paths = [
	'crates/blake3_wasm/jsr.json',
	'crates/blake3_wasm_small/jsr.json',
];
for (const jsr_path of jsr_paths) {
	const jsr_text = Deno.readTextFileSync(jsr_path);
	const jsr = JSON.parse(jsr_text);
	if (wetrun) {
		if (jsr.version === version) {
			console.log(`  ${jsr_path} already at v${version}`);
		} else {
			// Targeted replacement to preserve original file formatting
			const jsr_updated = jsr_text.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`);
			if (jsr_updated === jsr_text) {
				console.error(`  FAIL: could not find version field in ${jsr_path}`);
				Deno.exit(1);
			}
			Deno.writeTextFileSync(jsr_path, jsr_updated);
			console.log(`  Synced ${jsr_path} to v${version}`);
		}
	} else {
		if (jsr.version === version) {
			console.log(`  ${jsr_path}: v${version} (ok)`);
		} else {
			console.warn(`  WARN: ${jsr_path} at v${jsr.version}, wetrun would sync to v${version}`);
		}
	}
}

if (wetrun) {
	// Normalize formatting of files written by changeset version (package.json, CHANGELOG.md)
	// and the syncs above, so step 4's `deno fmt --check` passes cleanly.
	run('deno fmt', 'deno', ['fmt']);
}

// Step 4: Check

console.log('\n=== Step 4: Check (typecheck + test + clippy + fmt) ===');
run('deno task check', 'deno', ['task', 'check']);

// Step 5: Build

console.log('\n=== Step 5: Build WASM (all targets) ===');
run('deno task build:wasm', 'deno', ['task', 'build:wasm']);

// Step 6: Verify built package versions

console.log('\n=== Step 6: Verify built package versions ===');
for (const { label, dir } of web_packages) {
	const built_pkg = JSON.parse(Deno.readTextFileSync(`${dir}/package.json`));
	if (built_pkg.version === version) {
		console.log(`  PASS: ${label} = v${version}`);
	} else {
		console.error(`  FAIL: ${label} built at v${built_pkg.version}, expected v${version}`);
		console.error('  Cargo.toml version may be out of sync — wetrun syncs it automatically.');
		Deno.exit(1);
	}
}

// Step 7: Validate

console.log('\n=== Step 7: Validate npm packages + WASM sizes + correctness ===');
run('deno task validate:npm', 'deno', ['task', 'validate:npm']);
run('deno task validate:size', 'deno', ['task', 'validate:size']);
// Run correctness tests directly (WASM already built in Step 5 — skip the rebuild sub-tasks).
// Note: test:component (WASI component) is intentionally omitted — the component is not published.
run('test:deno (blake3_wasm)', 'deno', ['test', '--allow-read', 'scripts/compare.ts']);
run('test:deno:small (blake3_wasm_small)', 'deno', [
	'test',
	'--allow-read',
	'scripts/compare.ts',
	'--',
	'--small',
]);
run('deno task validate:compile', 'deno', ['task', 'validate:compile']);

// Step 8: Publish

console.log('\n=== Step 8: Publish to npm ===');

// Publish loop is idempotent: already-published packages are skipped, so retry after partial
// publish works automatically. Sentinel is kept through publishing and removed after all succeed.

for (let i = 0; i < web_packages.length; i++) {
	const { label, dir } = web_packages[i];
	if (wetrun) {
		if (is_published(label, version)) {
			console.log(`  SKIP: ${label}@${version} already published`);
			continue;
		}
		console.log(`  Publishing ${label}...`);
		const not_published = web_packages.slice(i);
		const fail_hint =
			`  Packages not published — re-run \`deno task publish --wetrun\` to retry, or publish manually:\n${
				not_published.map((p) => `    cd ${p.dir} && npm publish --access public`).join('\n')
			}`;
		run(`npm publish ${label}`, 'npm', ['publish', '--access', 'public'], dir, fail_hint);
		console.log(`  Published ${label}@${version}`);
	} else {
		console.log(`  [dry-run] ${label}:`);
		run(
			`npm publish --dry-run ${label}`,
			'npm',
			['publish', '--dry-run', '--access', 'public'],
			dir,
		);
	}
}

// Remove sentinel after all packages are published — retry is safe up to this point.
if (wetrun) {
	try {
		Deno.removeSync(SENTINEL_PATH);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) throw error;
	}
}

// Summary

console.log('\n=== Done ===');
if (wetrun) {
	for (const { label } of web_packages) {
		console.log(`  Published ${label}@${version} to npm`);
	}
	console.log('\n  Git commands to finalize the release:\n');
	console.log(`    git add .`);
	console.log(`    git commit -m "v${version}"`);
	console.log(`    git tag v${version}`);
	console.log(`    git push`);
	console.log(`    git push --tags`);
	console.log('');
} else {
	console.log(`  Dry-run complete for v${version} — all checks passed.`);
	console.log('  Run with --wetrun to publish to npm.');
	console.log('\n  After wetrun, finalize with:\n');
	console.log('    git add .');
	console.log(`    git commit -m "v<new_version>"`);
	console.log(`    git tag v<new_version>`);
	console.log('    git push');
	console.log('    git push --tags');
	console.log('');
}

// Helpers

function run(label: string, cmd: string, args: string[], cwd?: string, fail_hint?: string): void {
	const result = new Deno.Command(cmd, {
		args,
		cwd,
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit',
	}).outputSync();
	if (!result.success) {
		console.error(`\n  FAIL: ${label} (exit code ${result.code})`);
		if (fail_hint) console.error(fail_hint);
		Deno.exit(1);
	}
}

function find_changeset_cli(): string | null {
	const result = new Deno.Command('sh', {
		args: ['-c', 'command -v changeset'],
		stdout: 'piped',
		stderr: 'piped',
	}).outputSync();
	if (result.success) {
		return dec.decode(result.stdout).trim();
	}
	return null;
}

function is_published(pkg_name: string, target_version: string): boolean {
	const result = new Deno.Command('npm', {
		args: ['view', `${pkg_name}@${target_version}`, 'version'],
		stdout: 'piped',
		stderr: 'piped',
	}).outputSync();
	return result.success && dec.decode(result.stdout).trim() === target_version;
}

function has_pending_changesets(): boolean {
	try {
		for (const entry of Deno.readDirSync('.changeset')) {
			if (entry.isFile && entry.name.endsWith('.md') && entry.name !== 'README.md') {
				return true;
			}
		}
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) throw error;
		// .changeset/ doesn't exist — no pending changesets
	}
	return false;
}

function read_sentinel(): string | null {
	try {
		return Deno.readTextFileSync(SENTINEL_PATH).trim();
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) throw error;
		return null;
	}
}

function read_cargo_version(): string {
	const match = workspace_pkg_re.exec(Deno.readTextFileSync('Cargo.toml'));
	return match?.[2] ?? '';
}
