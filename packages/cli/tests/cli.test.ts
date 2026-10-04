import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GLOBAL_OPTIONS, parseArgs, splitCommand } from '../src/args';
import { CliError, EXIT, type ExitCode } from '../src/errors';
import { parseDefinitionFile, parseFieldSpec } from '../src/generators/crud/definition';
import { parseJunit } from '../src/generators/crud/verify';
import { columnName, pluralize, resourceNames } from '../src/generators/naming';
import { importPath, resolveInsideProject } from '../src/generators/paths';
import { applyChanges, buildChanges } from '../src/generators/plan';
import { addImport, insertAfterMarker } from '../src/generators/registration';

const PLAYGROUND = join(import.meta.dir, '../../../apps/playground');

function expectCliError(fn: () => unknown, exitCode: ExitCode, pattern: RegExp) {
  try {
    fn();
    throw new Error('expected CliError');
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(exitCode);
    expect((error as CliError).message).toMatch(pattern);
  }
}

describe('argument parsing', () => {
  test('finds the command after global options and parses values', () => {
    const { command, rest } = splitCommand(['--', '--cwd', '/x', 'make:crud', 'Product', '--fields=a:text:required']);
    expect(command).toBe('make:crud');
    const parsed = parseArgs(rest, [...GLOBAL_OPTIONS, { name: 'fields', type: 'string', description: '' }]);
    expect(parsed.positionals).toEqual(['Product']);
    expect(parsed.options).toEqual({ cwd: '/x', fields: 'a:text:required' });
  });

  test('unknown options, missing values and invalid enum values are usage errors (exit 2)', () => {
    const specs = [{ name: 'mode', type: 'string', values: ['a', 'b'], description: '' }] as const;
    expectCliError(() => parseArgs(['--nope'], specs), EXIT.USAGE, /Unknown option/);
    expectCliError(() => parseArgs(['--mode'], specs), EXIT.USAGE, /requires a value/);
    expectCliError(() => parseArgs(['--mode', 'c'], specs), EXIT.USAGE, /must be one of/);
    expectCliError(() => parseArgs(['--mode', 'a', '--mode', 'b'], specs), EXIT.USAGE, /more than once/);
  });
});

describe('naming and paths', () => {
  test('derives consistent names', () => {
    expect(resourceNames('OrderItem')).toMatchObject({
      camel: 'orderItem',
      kebab: 'order-item',
      constant: 'ORDER_ITEM',
      pluralCamel: 'orderItems',
      table: 'order_items',
      module: 'order-items',
    });
    expect(pluralize('category')).toBe('categories');
    expect(pluralize('box')).toBe('boxes');
    expect(columnName('launchAt')).toBe('launch_at');
    expectCliError(() => resourceNames('product'), EXIT.USAGE, /PascalCase/);
    expectCliError(() => resourceNames('Product', { module: 'Bad_Module' }), EXIT.USAGE, /kebab-case/);
  });

  test('rejects traversal and absolute paths', () => {
    expectCliError(() => resolveInsideProject('/root/app', '../etc/passwd'), EXIT.USAGE, /escapes/);
    expectCliError(() => resolveInsideProject('/root/app', '/etc/passwd'), EXIT.USAGE, /relative/);
    expect(importPath('bootstrap/providers.ts', 'app/modules/x/index.ts')).toBe('../app/modules/x');
    expect(importPath('app/modules/x/routes.ts', 'app/modules/x/schemas.ts')).toBe('./schemas');
  });
});

describe('field definitions', () => {
  test('parses compact syntax with modifiers', () => {
    const fields = parseFieldSpec(
      'name:text:required, price:numeric:default=9.99, note:text:nullable, on:boolean:default=true',
    );
    expect(fields.map((f) => [f.name, f.column, f.type, f.nullable, f.hasDefault, f.defaultLiteral])).toEqual([
      ['name', 'name', 'text', false, false, undefined],
      ['price', 'price', 'numeric', false, true, '9.99'],
      ['note', 'note', 'text', true, false, undefined],
      ['on', 'on', 'boolean', false, true, true],
    ]);
  });

  test('rejects unsupported types, reserved names, duplicates and missing modifiers', () => {
    expectCliError(() => parseFieldSpec('a:json:required'), EXIT.USAGE, /Unsupported type/);
    expectCliError(() => parseFieldSpec('id:uuid:required'), EXIT.USAGE, /generated automatically/);
    expectCliError(() => parseFieldSpec('a:text:required,a:text:nullable'), EXIT.USAGE, /declared twice/);
    expectCliError(() => parseFieldSpec('a:text'), EXIT.USAGE, /Invalid field/);
    expectCliError(() => parseFieldSpec('a:integer:default=x'), EXIT.USAGE, /must be an integer/);
    expectCliError(() => parseFieldSpec('a:uuid:default=x'), EXIT.USAGE, /not supported/);
  });

  test('definition files are strict about unknown features', () => {
    expect(parseDefinitionFile({ access: 'public', fields: [{ name: 'title', type: 'text' }] }).fields).toHaveLength(1);
    expectCliError(
      () => parseDefinitionFile({ access: 'public', fields: [{ name: 'title', type: 'text', unique: true }] }),
      EXIT.USAGE,
      /Invalid resource definition/,
    );
  });
});

describe('registration edits', () => {
  test('imports go after the last (multi-line) import and entries after markers', () => {
    const source =
      "import { a } from 'a';\nimport {\n  b,\n} from 'b';\n\nexport const list = [\n  // @framework:providers\n  x,\n];\n";
    const withImport = addImport(source, "import { c } from 'c';");
    expect(withImport.split('\n')[4]).toBe("import { c } from 'c';");
    const registered = insertAfterMarker(withImport, '@framework:providers', 'c,', 'file.ts');
    expect(registered).toContain('  // @framework:providers\n  c,\n  x,');
    expectCliError(
      () => insertAfterMarker(registered, '@framework:providers', 'c,', 'file.ts'),
      EXIT.FAILURE,
      /already contains/,
    );
    expectCliError(
      () => insertAfterMarker('no markers', '@framework:routes', 'x', 'file.ts'),
      EXIT.FAILURE,
      /not found/,
    );
  });
});

describe('staged file plans', () => {
  test('conflicts require --force; rollback restores updates and removes creations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fw-plan-'));
    try {
      await Bun.write(join(root, 'existing.ts'), 'original');
      await expect(buildChanges(root, [{ path: 'existing.ts', content: 'new' }], [], false)).rejects.toThrow(
        /Refusing to overwrite/,
      );

      const changes = await buildChanges(
        root,
        [{ path: 'nested/created.ts', content: 'created' }],
        [{ path: 'existing.ts', transform: (s) => `${s}+updated` }],
        false,
      );
      expect(changes.map((c) => c.action)).toEqual(['create', 'update']);
      const applied = await applyChanges(root, changes);
      expect(await Bun.file(join(root, 'existing.ts')).text()).toBe('original+updated');
      await applied.rollback();
      expect(await Bun.file(join(root, 'existing.ts')).text()).toBe('original');
      expect(await Bun.file(join(root, 'nested/created.ts')).exists()).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('verification report parsing', () => {
  test('reads passed and failed test cases from JUnit XML', () => {
    const xml =
      '<testsuite><testcase name="a &gt; b" time="0.1" /><testcase name="c"><failure message="x"/></testcase></testsuite>';
    expect(parseJunit(xml)).toEqual([
      { name: 'a > b', status: 'passed' },
      { name: 'c', status: 'failed' },
    ]);
  });
});

async function cli(args: string[]) {
  const child = Bun.spawn(['bun', 'run', 'bin/cli.ts', ...args], { cwd: PLAYGROUND, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

describe('CLI process contract', () => {
  test('exit codes: 0 success, 2 usage, 3 unsupported; JSON envelope on stdout', async () => {
    const list = await cli(['--json', 'list']);
    expect(list.code).toBe(0);
    const body = JSON.parse(list.stdout) as {
      command: string;
      status: string;
      data: { commands: { status: string }[] };
      warnings: unknown[];
    };
    expect(body).toMatchObject({ command: 'list', status: 'ok', warnings: [] });
    expect(body.data.commands.some((c) => c.status === 'planned')).toBe(true);

    expect((await cli(['make:crud'])).code).toBe(EXIT.USAGE);
    expect((await cli(['nope'])).code).toBe(EXIT.USAGE);
    const planned = await cli(['--json', 'queue:failed']);
    expect(planned.code).toBe(EXIT.UNSUPPORTED);
    expect(JSON.parse(planned.stdout)).toMatchObject({ status: 'error', error: { code: 'UNSUPPORTED_CAPABILITY' } });
    // The playground registers the auth module, so authenticated access is a
    // legal dry run here; the refusal path (no auth module) is covered by the
    // generated-app e2e suite.
    expect(
      (await cli(['make:crud', 'Thing', '--fields', 'a:text:required', '--access', 'authenticated', '--dry-run'])).code,
    ).toBe(0);
  });

  test('dry run writes nothing and needs no database', async () => {
    const before = await snapshot(PLAYGROUND);
    const result = await cli([
      '--json',
      'make:crud',
      'Widget',
      '--fields',
      'label:text:required',
      '--access',
      'public',
      '--dry-run',
      '--verify',
    ]);
    expect(result.code).toBe(0);
    const data = JSON.parse(result.stdout).data as {
      dryRun: boolean;
      changes: { path: string }[];
      endpoints: unknown[];
    };
    expect(data.dryRun).toBe(true);
    expect(data.changes.map((c) => c.path)).toContain('app/modules/widgets/routes.ts');
    expect(data.endpoints).toHaveLength(5);
    expect(await snapshot(PLAYGROUND)).toEqual(before);
  });

  test('help describes options and examples', async () => {
    const help = await cli(['make:crud', '--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('--fields');
    expect(help.stdout).toContain('Examples:');
  });
});

async function snapshot(root: string): Promise<string[]> {
  const glob = new Bun.Glob('**/*.{ts,sql,json}');
  const entries: string[] = [];
  for await (const path of glob.scan({ cwd: root, onlyFiles: true })) {
    if (path.startsWith('node_modules/')) continue;
    entries.push(`${path}:${Bun.hash(await Bun.file(join(root, path)).text())}`);
  }
  return entries.sort();
}
