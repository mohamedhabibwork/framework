#!/usr/bin/env bun
/**
 * Multi-repository ecosystem synchronizer & submodule linker for `mohamedhabibwork/framework`.
 *
 * Provisions, syncs, and links (via Git submodules in `.gitmodules`):
 *   1. All 25 `@framework/*` packages in `packages/<pkg>` -> `mohamedhabibwork/framework-<pkg>`
 *      - `main` branch mirrors `packages/<pkg>` for the monorepo submodule link
 *      - `standalone` branch & `v<version>` tag rewrite `workspace:*` to
 *        `github:mohamedhabibwork/framework-<dep>#standalone` for standalone installs
 *   2. Starter application template in `template` -> `mohamedhabibwork/framework-app` (GitHub Template Repo)
 *   3. Documentation site in `apps/docs` -> `mohamedhabibwork/framework-docs`
 *
 * Usage:
 *   bun run sync:repos                       # sync all 27 repos to GitHub & update submodule links
 *   bun run sync:repos -- --dry-run          # stage and validate locally without pushing
 *   bun run sync:repos -- --only=core,http   # sync specific targets (package names, "app", or "docs")
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { toStandalonePackageJson } from '../packages/cli/src/commands/create';
import { appTemplateFiles } from '../packages/cli/src/generators/app/templates';

const OWNER = process.env.GITHUB_OWNER ?? 'mohamedhabibwork';
const MAIN_REPO = `${OWNER}/framework`;
const MAIN_REPO_URL = `https://github.com/${MAIN_REPO}`;
const DOCS_REPO = `${OWNER}/framework-docs`;
const DOCS_REPO_URL = `https://github.com/${DOCS_REPO}`;
const APP_REPO = `${OWNER}/framework-app`;
const APP_REPO_URL = `https://github.com/${APP_REPO}`;
const DOCS_SITE_URL = 'https://framework.habib.cloud';

const repoRoot = resolve(import.meta.dirname, '..');
const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { version: string };
const version = rootPkg.version;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const onlySet = onlyArg
  ? new Set(
      onlyArg
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null;

function print(line: string) {
  process.stdout.write(`${line}\n`);
}

function run(
  command: string,
  cmdArgs: string[],
  options: { cwd?: string; capture?: boolean; allowFail?: boolean } = {},
): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(command, cmdArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
  const ok = result.status === 0;
  const stdout = (result.stdout ?? '').toString().trim();
  const stderr = (result.stderr ?? '').toString().trim();
  if (!ok && !options.allowFail) {
    throw new Error(`Command failed: ${command} ${cmdArgs.join(' ')}\n${stderr || stdout}`);
  }
  return { ok, stdout, stderr };
}

const headSha = run('git', ['rev-parse', '--short', 'HEAD'], { capture: true }).stdout;

function ensureGitHubRepo(
  fullName: string,
  description: string,
  homepage: string,
  options: { isTemplate?: boolean } = {},
) {
  if (dryRun) {
    print(`  [dry-run] would ensure GitHub repo ${fullName} (template=${Boolean(options.isTemplate)})`);
    return;
  }
  const exists = run('gh', ['repo', 'view', fullName, '--json', 'name'], { capture: true, allowFail: true }).ok;
  if (!exists) {
    print(`  Creating GitHub repository ${fullName}...`);
    run('gh', ['repo', 'create', fullName, '--public', '--description', description, '--homepage', homepage], {
      capture: true,
    });
  } else {
    run('gh', ['repo', 'edit', fullName, '--description', description, '--homepage', homepage], {
      capture: true,
      allowFail: true,
    });
  }
  if (options.isTemplate) {
    run('gh', ['api', '-X', 'PATCH', `repos/${fullName}`, '-f', 'is_template=true'], {
      capture: true,
      allowFail: true,
    });
  }
}

function commitAndPushInPlace(
  localDir: string,
  relPath: string,
  fullName: string,
  commitMessage: string,
  options: { tagVersion?: boolean } = {},
): string {
  const remoteUrl = `https://github.com/${fullName}.git`;
  if (!existsSync(join(localDir, '.git'))) {
    run('git', ['init', '-b', 'main'], { cwd: localDir, capture: true });
  } else {
    run('git', ['checkout', '-B', 'main'], { cwd: localDir, capture: true });
  }
  run('git', ['config', 'user.name', 'Mohamed Habib'], { cwd: localDir, capture: true });
  run('git', ['config', 'user.email', 'mohamedhabibwork@users.noreply.github.com'], {
    cwd: localDir,
    capture: true,
  });
  const hasOrigin = run('git', ['remote', 'get-url', 'origin'], {
    cwd: localDir,
    capture: true,
    allowFail: true,
  }).ok;
  if (hasOrigin) {
    run('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: localDir, capture: true });
  } else {
    run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: localDir, capture: true });
  }

  run('git', ['add', '-A'], { cwd: localDir, capture: true });
  const status = run('git', ['status', '--porcelain'], { cwd: localDir, capture: true }).stdout;
  const hasHead = run('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: localDir,
    capture: true,
    allowFail: true,
  }).ok;
  if (status !== '' || !hasHead) {
    run('git', ['commit', '-m', commitMessage], { cwd: localDir, capture: true });
  }
  if (options.tagVersion) {
    run('git', ['tag', '-f', `v${version}`], { cwd: localDir, capture: true });
  }

  const sha = run('git', ['rev-parse', 'HEAD'], { cwd: localDir, capture: true }).stdout;

  if (!dryRun) {
    const pushArgs = ['push', '--force', 'origin', 'main'];
    if (options.tagVersion) pushArgs.push('--tags');
    run('git', pushArgs, { cwd: localDir, capture: true });
    // Link path in main repo index as a Git submodule gitlink
    run('git', ['rm', '-r', '--cached', '--ignore-unmatch', relPath], { capture: true, allowFail: true });
    run('git', ['config', '-f', '.gitmodules', `submodule.${relPath}.path`, relPath], { capture: true });
    run('git', ['config', '-f', '.gitmodules', `submodule.${relPath}.url`, remoteUrl], { capture: true });
    run('git', ['config', '-f', '.gitmodules', `submodule.${relPath}.branch`, 'main'], { capture: true });
    run('git', ['update-index', '--add', '--cacheinfo', `160000,${sha},${relPath}`], { capture: true });
  }
  return sha;
}

function pushStandaloneBranch(stageDir: string, fullName: string, commitMessage: string) {
  run('git', ['init', '-b', 'standalone'], { cwd: stageDir, capture: true });
  run('git', ['config', 'user.name', 'Mohamed Habib'], { cwd: stageDir, capture: true });
  run('git', ['config', 'user.email', 'mohamedhabibwork@users.noreply.github.com'], {
    cwd: stageDir,
    capture: true,
  });
  run('git', ['add', '-A'], { cwd: stageDir, capture: true });
  run('git', ['commit', '-m', commitMessage], { cwd: stageDir, capture: true });
  run('git', ['tag', '-f', `v${version}`], { cwd: stageDir, capture: true });

  if (dryRun) {
    print(`  [dry-run] staged standalone branch for ${fullName} at ${stageDir}`);
    return;
  }

  const remoteUrl = `https://github.com/${fullName}.git`;
  run('git', ['remote', 'add', 'origin', remoteUrl], { cwd: stageDir, capture: true });
  run('git', ['push', '--force', 'origin', 'standalone', `refs/tags/v${version}:refs/tags/v${version}`], {
    cwd: stageDir,
    capture: true,
  });
}

function buildStandalonePackageManifest(pkgName: string): Record<string, unknown> {
  const pkgPath = join(repoRoot, 'packages', pkgName, 'package.json');
  const raw = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
  const rewriteDeps = (deps: Record<string, string> | undefined) => {
    if (!deps) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(deps)) {
      if (k.startsWith('@framework/') && v === 'workspace:*') {
        const depShort = k.replace(/^@framework\//, '');
        out[k] = `github:${OWNER}/framework-${depShort}#standalone`;
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  const manifest: Record<string, unknown> = {
    name: raw.name,
    version: raw.version,
    description: raw.description,
    license: raw.license ?? 'MIT',
    type: raw.type ?? 'module',
    homepage: `${MAIN_REPO_URL}/tree/main/packages/${pkgName}`,
    repository: {
      type: 'git',
      url: `git+https://github.com/${OWNER}/framework-${pkgName}.git`,
    },
    bugs: {
      url: `${MAIN_REPO_URL}/issues`,
    },
    main: './src/index.ts',
    types: './src/index.ts',
  };
  if (raw.bin) manifest.bin = raw.bin;
  if (raw.exports) manifest.exports = raw.exports;
  const dependencies = rewriteDeps(raw.dependencies as Record<string, string> | undefined);
  const devDependencies = rewriteDeps(raw.devDependencies as Record<string, string> | undefined);
  if (dependencies) manifest.dependencies = dependencies;
  if (devDependencies) manifest.devDependencies = devDependencies;
  return manifest;
}

function syncPackage(pkgName: string, scratchRoot: string) {
  const fullName = `${OWNER}/framework-${pkgName}`;
  const relPath = `packages/${pkgName}`;
  const srcPkgDir = join(repoRoot, relPath);
  const manifest = buildStandalonePackageManifest(pkgName);
  const description = `${String(manifest.description ?? '')} (Part of ${MAIN_REPO})`.trim();

  print(`-> Package @framework/${pkgName} (${fullName} <-> ${relPath})`);
  ensureGitHubRepo(fullName, description, MAIN_REPO_URL);

  writeFileSync(join(srcPkgDir, '.gitignore'), 'node_modules/\ndist/\ncoverage/\n.DS_Store\n');

  const sha = commitAndPushInPlace(
    srcPkgDir,
    relPath,
    fullName,
    `chore(sync): @framework/${pkgName} v${version} from ${MAIN_REPO}@${headSha}`,
  );

  // Also publish `standalone` branch + `v<version>` tag with GitHub dependency specifiers
  const stageDir = join(scratchRoot, `framework-${pkgName}`);
  mkdirSync(stageDir, { recursive: true });
  for (const entry of readdirSync(srcPkgDir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'package.json' || entry === 'tsconfig.json') continue;
    cpSync(join(srcPkgDir, entry), join(stageDir, entry), { recursive: true, verbatimSymlinks: true });
  }
  writeFileSync(join(stageDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const baseTsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.base.json'), 'utf8')) as {
    compilerOptions: Record<string, unknown>;
  };
  writeFileSync(
    join(stageDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: baseTsconfig.compilerOptions,
        include: ['src/**/*.ts', 'tests/**/*.ts'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    )}\n`,
  );
  pushStandaloneBranch(
    stageDir,
    fullName,
    `chore(release): @framework/${pkgName} v${version} standalone from ${MAIN_REPO}@${headSha}`,
  );
  print(`  Linked ${relPath} @ ${sha.slice(0, 7)} -> ${fullName} (main + standalone + v${version})`);
}

function syncAppTemplate() {
  const relPath = 'template';
  const stageDir = join(repoRoot, relPath);
  const description = `Starter application template for ${MAIN_REPO} (Bun + Hono + Drizzle + Zod)`;
  print(`-> Starter App Template (${APP_REPO} <-> ${relPath})`);
  ensureGitHubRepo(APP_REPO, description, MAIN_REPO_URL, { isTemplate: true });

  mkdirSync(stageDir, { recursive: true });

  const files = appTemplateFiles({
    name: 'framework-app',
    className: 'FrameworkApp',
    apiTitle: 'Framework App API',
  });

  for (const file of files) {
    const dest = join(stageDir, file.path);
    mkdirSync(resolve(dest, '..'), { recursive: true });
    if (file.path === 'package.json') {
      const standaloneRaw = JSON.parse(toStandalonePackageJson(file.content)) as Record<string, unknown>;
      const enriched = {
        name: standaloneRaw.name,
        version,
        description: 'Starter API application built on mohamedhabibwork/framework',
        private: true,
        type: standaloneRaw.type,
        homepage: MAIN_REPO_URL,
        repository: {
          type: 'git',
          url: `git+${APP_REPO_URL}.git`,
        },
        bugs: {
          url: `${MAIN_REPO_URL}/issues`,
        },
        scripts: standaloneRaw.scripts,
        dependencies: standaloneRaw.dependencies,
        devDependencies: standaloneRaw.devDependencies,
      };
      writeFileSync(dest, `${JSON.stringify(enriched, null, 2)}\n`);
    } else if (file.path === 'Dockerfile') {
      writeFileSync(
        dest,
        `FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .

FROM oven/bun:1.4.2-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["bun", "run", "bin/server.ts"]
`,
      );
    } else {
      writeFileSync(dest, file.content);
    }
  }

  writeFileSync(
    join(stageDir, 'README.md'),
    `# Framework Application Template (\`${APP_REPO}\`)

Starter application template for [**${MAIN_REPO}**](${MAIN_REPO_URL}) — a Laravel-inspired TypeScript backend framework powered by **Bun**, **Hono**, **Drizzle ORM**, and **Zod**.

## Ecosystem Links

- **Main Framework Repository**: [${MAIN_REPO}](${MAIN_REPO_URL})
- **Starter App Template**: [${APP_REPO}](${APP_REPO_URL})
- **Documentation Repository**: [${DOCS_REPO}](${DOCS_REPO_URL})
- **Live Documentation**: [${DOCS_SITE_URL}](${DOCS_SITE_URL})

## Create a New Application

### Option 1: GitHub CLI / "Use this template"

\`\`\`sh
gh repo create my-api --template ${APP_REPO} --clone --private
cd my-api
cp .env.example .env
bun install
\`\`\`

### Option 2: Framework CLI

From inside the [\`${MAIN_REPO}\`](${MAIN_REPO_URL}) workspace:

\`\`\`sh
bun run cli -- create ../my-api
\`\`\`

## Quickstart

\`\`\`sh
# 1. Start PostgreSQL & Redis
docker compose -f deployment/compose.yaml up -d --wait

# 2. Generate and apply initial database migrations
bun run cli -- db:generate --name create-audit-logs
bun run cli -- db:migrate

# 3. Scaffold a full CRUD resource module (schema, DTOs, service, controller, policy, routes, OpenAPI, tests)
bun run cli -- make:crud Product \\
  --module products \\
  --fields 'name:text:required,price:numeric:required' \\
  --access public \\
  --verify

# 4. Run the development server
bun run dev          # http://127.0.0.1:3000/health/ready
bun run worker       # optional: background queue worker
\`\`\`

## Included Framework Packages

All \`@framework/*\` packages are linked directly to their dedicated GitHub repositories:

- [\`@framework/core\`](https://github.com/${OWNER}/framework-core)
- [\`@framework/http\`](https://github.com/${OWNER}/framework-http)
- [\`@framework/database\`](https://github.com/${OWNER}/framework-database)
- [\`@framework/crud\`](https://github.com/${OWNER}/framework-crud)
- [\`@framework/validation\`](https://github.com/${OWNER}/framework-validation)
- [\`@framework/events\`](https://github.com/${OWNER}/framework-events)
- [\`@framework/queue\`](https://github.com/${OWNER}/framework-queue)
- [\`@framework/cache\`](https://github.com/${OWNER}/framework-cache)
- [\`@framework/logging\`](https://github.com/${OWNER}/framework-logging)
- [\`@framework/storage\`](https://github.com/${OWNER}/framework-storage)
- [\`@framework/openapi\`](https://github.com/${OWNER}/framework-openapi)
- [\`@framework/support\`](https://github.com/${OWNER}/framework-support)
- [\`@framework/cli\`](https://github.com/${OWNER}/framework-cli)
- [\`@framework/testing\`](https://github.com/${OWNER}/framework-testing)
`,
  );

  const ciDir = join(stageDir, '.github', 'workflows');
  mkdirSync(ciDir, { recursive: true });
  writeFileSync(
    join(ciDir, 'ci.yml'),
    `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    name: Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: bun install
      - run: bun run typecheck
`,
  );

  const sha = commitAndPushInPlace(
    stageDir,
    relPath,
    APP_REPO,
    `chore(sync): starter app template v${version} from ${MAIN_REPO}@${headSha}`,
    { tagVersion: true },
  );
  print(`  Linked ${relPath} @ ${sha.slice(0, 7)} -> ${APP_REPO} (main + v${version})`);
}

function syncDocsRepo(scratchRoot: string) {
  const relPath = 'apps/docs';
  const appsDocsDir = join(repoRoot, relPath);
  const description = `Official Starlight documentation and reference guides for ${MAIN_REPO}`;
  print(`-> Documentation Repository (${DOCS_REPO} <-> ${relPath})`);
  ensureGitHubRepo(DOCS_REPO, description, DOCS_SITE_URL);

  const sha = commitAndPushInPlace(
    appsDocsDir,
    relPath,
    DOCS_REPO,
    `chore(sync): documentation v${version} from ${MAIN_REPO}@${headSha}`,
  );

  // Also publish `standalone` branch + `v<version>` tag with root `docs/` guides & standalone Dockerfile
  const stageDir = join(scratchRoot, 'framework-docs');
  mkdirSync(stageDir, { recursive: true });

  for (const entry of readdirSync(appsDocsDir)) {
    if (['node_modules', 'dist', '.astro', '.wrangler', '.git', 'Dockerfile'].includes(entry)) continue;
    cpSync(join(appsDocsDir, entry), join(stageDir, entry), { recursive: true, verbatimSymlinks: true });
  }

  const rootDocsDir = join(repoRoot, 'docs');
  if (existsSync(rootDocsDir)) {
    cpSync(rootDocsDir, join(stageDir, 'docs'), { recursive: true, verbatimSymlinks: true });
  }

  writeFileSync(
    join(stageDir, 'Dockerfile'),
    `# Documentation site image for ${DOCS_REPO} (linked with ${MAIN_REPO}).
#
#   docker build -t framework-docs .
#
FROM oven/bun:1.4.2 AS build
WORKDIR /repo
COPY . .
RUN bun install
RUN bun run build

FROM nginx:1.29-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
`,
  );

  const workflowsDir = join(stageDir, '.github', 'workflows');
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(
    join(workflowsDir, 'docs.yml'),
    `name: Docs

on:
  push:
    branches: [main, standalone]
  pull_request:
  workflow_dispatch:

concurrency:
  group: docs-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Build docs site
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: bun install
      - name: Build
        run: bun run build

  image:
    name: Build docs image
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t framework-docs:ci .
`,
  );

  pushStandaloneBranch(
    stageDir,
    DOCS_REPO,
    `chore(release): documentation standalone v${version} from ${MAIN_REPO}@${headSha}`,
  );
  print(`  Linked ${relPath} @ ${sha.slice(0, 7)} -> ${DOCS_REPO} (main + standalone + v${version})`);
}

function main() {
  const scratchRoot = mkdtempSync(join(tmpdir(), 'framework-sync-'));
  print(`Syncing & linking ecosystem repositories for ${MAIN_REPO} v${version} (commit ${headSha})...`);
  try {
    if (!dryRun && !onlySet) {
      run(
        'gh',
        [
          'repo',
          'edit',
          MAIN_REPO,
          '--description',
          'Laravel-inspired TypeScript framework on Bun + Hono + Drizzle + Zod',
          '--homepage',
          DOCS_SITE_URL,
        ],
        { capture: true, allowFail: true },
      );
    }

    const packages = readdirSync(join(repoRoot, 'packages')).sort();
    for (const pkg of packages) {
      if (onlySet && !onlySet.has(pkg)) continue;
      syncPackage(pkg, scratchRoot);
    }

    if (!onlySet || onlySet.has('app')) {
      syncAppTemplate();
    }

    if (!onlySet || onlySet.has('docs')) {
      syncDocsRepo(scratchRoot);
    }

    if (!dryRun) {
      run('git', ['submodule', 'init'], { capture: true });
      run('git', ['submodule', 'absorbgitdirs'], { capture: true });
      print('\nInitialized and absorbed all submodule git directories into .git/modules/.');
    }

    print('All requested repositories synced and linked to main repo paths.');
  } finally {
    if (!dryRun) {
      rmSync(scratchRoot, { recursive: true, force: true });
    } else {
      print(`Dry-run staging directory preserved at: ${scratchRoot}`);
    }
  }
}

main();
