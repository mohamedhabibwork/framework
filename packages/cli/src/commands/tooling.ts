import { flag, stringOption } from '../args';
import { type CommandContext, defineCommand } from '../command';
import { failure } from '../errors';
import { runProcess, tail } from '../process';

const TOOL_TIMEOUT_MS = 10 * 60_000;

async function delegate(context: CommandContext, command: readonly string[], code: string) {
  const result = await runProcess(command, {
    cwd: context.root,
    timeoutMs: TOOL_TIMEOUT_MS,
    signal: context.signal,
    stream: !context.json,
  });
  if (result.timedOut) throw failure(`${code}_TIMEOUT`, `${command[0]} timed out`);
  if (result.exitCode !== 0)
    throw failure(
      `${code}_FAILED`,
      `${command.join(' ')} exited with ${result.exitCode}`,
      context.json ? tail(result.stdout + result.stderr) : undefined,
    );
  return { data: { command: [...command], exitCode: 0 } };
}

export const toolingCommands = [
  defineCommand({
    name: 'typecheck',
    group: 'tooling',
    status: 'implemented',
    description: 'TypeScript checking without emitting files',
    run: (_input, context) => delegate(context, context.project.tools.typecheck, 'TYPECHECK'),
  }),
  defineCommand({
    name: 'test',
    group: 'tooling',
    status: 'implemented',
    description: 'Run the configured test suites (bun test)',
    options: [
      { name: 'filter', type: 'string', placeholder: '<pattern>', description: 'Only test names matching pattern' },
      {
        name: 'type',
        type: 'string',
        values: ['unit', 'feature', 'integration'],
        description: 'Restrict to a suite directory',
      },
      { name: 'coverage', type: 'boolean', description: 'Collect coverage' },
      { name: 'watch', type: 'boolean', description: 'Re-run on change' },
    ],
    run: ({ options }, context) => {
      const type = stringOption(options, 'type');
      const filter = stringOption(options, 'filter');
      return delegate(
        context,
        [
          ...context.project.tools.test,
          ...(type ? [`tests/${type}`] : []),
          ...(filter ? ['--test-name-pattern', filter] : []),
          ...(flag(options, 'coverage') ? ['--coverage'] : []),
          ...(flag(options, 'watch') ? ['--watch'] : []),
        ],
        'TEST',
      );
    },
  }),
  defineCommand({
    name: 'lint',
    group: 'tooling',
    status: 'implemented',
    description: 'Run configured lint tools; --fix applies safe fixes explicitly',
    options: [{ name: 'fix', type: 'boolean', description: 'Apply safe fixes' }],
    run: ({ options }, context) =>
      delegate(context, [...context.project.tools.lint, ...(flag(options, 'fix') ? ['--write'] : [])], 'LINT'),
  }),
  defineCommand({
    name: 'format',
    group: 'tooling',
    status: 'implemented',
    description: 'Format sources; --check performs no writes',
    options: [{ name: 'check', type: 'boolean', description: 'Report only' }],
    run: ({ options }, context) =>
      delegate(context, [...context.project.tools.format, ...(flag(options, 'check') ? [] : ['--write'])], 'FORMAT'),
  }),
];
