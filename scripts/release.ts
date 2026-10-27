#!/usr/bin/env bun
/**
 * Release flow: bump versions, generate the changelog section, commit, tag
 * and — for pre-1.0 minor bumps — freeze the docs snapshot of the previous
 * line. Run from the repository root:
 *
 *   bun run release -- 0.2.0          # normal release
 *   bun run release -- 0.2.1 --skip-checks   # skip typecheck + test suite
 *
 * Semantics:
 * - Refuses unless the git tree is clean, the version is a strict semver bump
 *   (`X.Y.Z`, greater than the current root package version) and — unless
 *   `--skip-checks` is passed — `bun run typecheck` and `bun run test` pass.
 * - Updates the root and every workspace package's `package.json` version,
 *   and every `frameworkVersion: '…'` / `cliVersion: '…'` pin in the
 *   generated-app template and the reference apps' `bin/cli.ts`. The
 *   version-sync test keeps these aligned between releases.
 * - Turns the curated `## [Unreleased]` notes into the `## [X.Y.Z] — date`
 *   section (leaving Unreleased empty); when Unreleased is empty, the section
 *   is grouped from the commit subjects since the last tag instead
 *   (conventional-commit prefix stripped).
 * - Commits everything as `chore(release): vX.Y.Z` and tags `vX.Y.Z`. The
 *   docs snapshot (when triggered) is folded into that same commit so the
 *   tree ends clean.
 * - Snapshot rule: before 1.0, a minor bump archives the previous docs line
 *   via apps/docs/scripts/snapshot-version.mjs (the only supported caller).
 *
 * Deliberately NOT done here: publishing packages, deploying the docs site
 * (Dokploy redeploys the docs when main is pushed) and pushing to a remote.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const packageJsonPath = join(repoRoot, 'package.json');
const templatesPath = join(repoRoot, 'packages', 'cli', 'src', 'generators', 'app', 'templates.ts');
const changelogPath = join(repoRoot, 'CHANGELOG.md');

function print(line: string) {
  process.stdout.write(`${line}\n`);
}

function fail(message: string): never {
  console.error(`release: ${message}`);
  process.exit(1);
}

function run(command: string, args: string[], options: { cwd?: string; capture?: boolean } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
  if (result.error) fail(`${command} failed to start: ${result.error.message}`);
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').toString().trim(),
  };
}

// --- Parse and validate arguments -------------------------------------------

const skipChecks = process.argv.includes('--skip-checks');
const positional = process.argv.slice(2).filter((arg) => arg !== '--skip-checks');
const version = positional[0];

if (!version) fail('missing <version> argument, e.g. `bun run release -- 0.2.0`');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`"${version}" is not a plain semver X.Y.Z`);

const [, newMajorStr, newMinorStr, newPatchStr] = version.match(/^(\d+)\.(\d+)\.(\d+)$/) ?? [];
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };
const current = packageJson.version;
const [, oldMajorStr, oldMinorStr, oldPatchStr] = current.match(/^(\d+)\.(\d+)\.(\d+)$/) ?? [];
if (!newMajorStr || !oldMajorStr) fail(`cannot compare versions "${current}" -> "${version}"`);

const isNewer =
  Number(newMajorStr) > Number(oldMajorStr) ||
  (Number(newMajorStr) === Number(oldMajorStr) &&
    (Number(newMinorStr) > Number(oldMinorStr) ||
      (Number(newMinorStr) === Number(oldMinorStr) && Number(newPatchStr) > Number(oldPatchStr))));
if (!isNewer) {
  fail(`"${version}" is not a bump of "${current}" — every release must increase the version`);
}

// --- Preconditions -----------------------------------------------------------

const gitStatus = run('git', ['status', '--porcelain'], { capture: true });
if (!gitStatus.ok || gitStatus.stdout !== '') {
  fail('the git tree must be clean before releasing — commit or stash your changes first');
}

if (!skipChecks) {
  print('Running typecheck...');
  if (!run('bun', ['run', 'typecheck']).ok) fail('typecheck failed (use --skip-checks to bypass deliberately)');
  print('Running the test suite...');
  if (!run('bun', ['run', 'test']).ok) fail('tests failed (use --skip-checks to bypass deliberately)');
} else {
  print('Skipping typecheck and tests (--skip-checks).');
}

// --- Mutate files ------------------------------------------------------------

const lastTag = run('git', ['describe', '--tags', '--abbrev=0'], { capture: true }).stdout || undefined;
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const subjects = run('git', ['log', '--format=%s', range], { capture: true })
  .stdout.split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

writeFileSync(packageJsonPath, `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`);

for (const dir of ['packages', 'apps']) {
  for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
    const manifestPath = join(repoRoot, dir, entry.name, 'package.json');
    if (!entry.isDirectory() || !Bun.file(manifestPath).size) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: string };
    // Workspace packages carry the framework version; apps without one (and the
    // docs site's own 0.0.x line) are left alone.
    if (dir === 'packages' && manifest.version !== undefined) {
      writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
    }
  }
}
print(`Bumped workspace package versions to ${version}.`);

const VERSION_PIN = /(frameworkVersion|cliVersion):\s*'[^']*'/g;
const pinFiles = [
  templatesPath,
  ...readdirSync(join(repoRoot, 'apps'))
    .map((name) => join(repoRoot, 'apps', name, 'bin', 'cli.ts'))
    .filter((path) => Bun.file(path).size > 0),
];
if (!/frameworkVersion:\s*'[^']*'/.test(readFileSync(templatesPath, 'utf8')))
  fail(`no frameworkVersion pin found in ${templatesPath}`);
for (const path of pinFiles) {
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll(VERSION_PIN, `$1: '${version}'`));
}
print(`Pinned frameworkVersion/cliVersion to ${version} in ${pinFiles.length} files.`);

writeFileSync(
  changelogPath,
  prependChangelog(readFileSync(changelogPath, 'utf8'), version, changelogSection(subjects, version)),
);
print('Prepended the CHANGELOG.md section.');

// --- Docs snapshot for pre-1.0 minor bumps -----------------------------------

const newLine = `${newMajorStr}.${newMinorStr}`;
const minorChanged = version.startsWith('0.') && newMinorStr !== oldMinorStr;
const snapshotRan = minorChanged && run('bun', [join('apps', 'docs', 'scripts', 'snapshot-version.mjs'), newLine]).ok;
if (minorChanged && !snapshotRan) fail('docs snapshot script failed — fix the docs app before retrying');

// --- Commit and tag ----------------------------------------------------------

run('git', ['add', '-A']);
if (!run('git', ['commit', '-m', `chore(release): v${version}`]).ok) fail('git commit failed');
if (!run('git', ['tag', `v${version}`]).ok) fail('git tag failed');

// --- Report ------------------------------------------------------------------

print(`\nRelease v${version} prepared from ${range} (${subjects.length} commits).`);
print('Done:');
print('  - root package.json version bumped');
print('  - workspace package versions and frameworkVersion/cliVersion pins updated');
print('  - CHANGELOG.md section prepended');
if (snapshotRan) {
  print(`  - previous docs line archived via snapshot-version.mjs (docs locale v${newLine.replaceAll('.', '')})`);
}
print(`  - committed chore(release): v${version} and tagged v${version}`);
print('Not done (deliberate):');
print('  - no package publish');
print('  - docs site not deployed — Dokploy redeploys it when main is pushed');
print('  - nothing pushed to a remote');

// --- Changelog helpers -------------------------------------------------------

/** Commits grouped the same way the seeded CHANGELOG.md groups them. */
function changelogSection(entries: string[], releaseVersion: string): string {
  const groups: Record<string, string[]> = {
    Features: [],
    Fixes: [],
    Performance: [],
    Refactoring: [],
    Documentation: [],
    Style: [],
    Tests: [],
    Chores: [],
    Other: [],
  };
  const typeToGroup: Record<string, keyof typeof groups> = {
    feat: 'Features',
    fix: 'Fixes',
    perf: 'Performance',
    refactor: 'Refactoring',
    docs: 'Documentation',
    style: 'Style',
    test: 'Tests',
    chore: 'Chores',
    build: 'Chores',
    ci: 'Chores',
  };
  for (const subject of entries) {
    const match = subject.match(/^(\w+)(?:\([^)]*\))?:\s*(.+)$/);
    const type = match?.[1] ?? '';
    const text = match?.[2] ?? subject;
    const group = typeToGroup[type] ?? 'Other';
    groups[group].push(text.charAt(0).toUpperCase() + text.slice(1));
  }
  const lines = [`## [${releaseVersion}] — ${new Date().toISOString().slice(0, 10)}`];
  for (const [group, groupEntries] of Object.entries(groups)) {
    if (groupEntries.length === 0) continue;
    lines.push('', `### ${group}`, '', ...groupEntries.map((entry) => `- ${entry}`));
  }
  return `${lines.join('\n')}\n`;
}

/** Inserts the new release section between [Unreleased] and the previous release. */
function prependChangelog(changelog: string, releaseVersion: string, section: string): string {
  const unreleased = '## [Unreleased]';
  const startIndex = changelog.indexOf(unreleased);
  if (startIndex === -1) fail('CHANGELOG.md has no "## [Unreleased]" section');
  const nextHeading = changelog.indexOf('\n## [', startIndex + unreleased.length);
  const insertAt = nextHeading === -1 ? changelog.length : nextHeading + 1;
  // Curated notes win over commit subjects; Unreleased starts over empty.
  const curated = changelog.slice(startIndex + unreleased.length, insertAt).trim();
  const body = curated ? `${section.split('\n')[0]}\n\n${curated}\n` : section;
  const withSection = `${changelog.slice(0, startIndex)}${unreleased}\n\n${body}\n${changelog.slice(insertAt)}`;
  return `${withSection.trimEnd()}\n[${releaseVersion}]: https://framework.habib.cloud/releases/\n`;
}
