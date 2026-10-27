#!/usr/bin/env bun
/**
 * Per-package coverage gate. Runs the whole workspace suite once with lcov
 * coverage, aggregates line/function hits per package and enforces the
 * thresholds below. `--report` measures and prints without enforcing.
 *
 *   bun run coverage              # suite + gate (CI step)
 *   bun run coverage -- --report  # suite + table, exit 0 (measurement)
 *
 * Known limitation: Bun's coverage only reports files a test run actually
 * loaded. A src file no test imports is invisible rather than 0%, so the
 * thresholds are regression guards, not whole-tree guarantees.
 *
 * Thresholds are measured baselines minus a small margin: they fail when
 * coverage regresses, not when a new file lands slightly below today's bar.
 * Template-literal generator files are excluded via bunfig.toml (authored
 * strings, not executed logic).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const LCOV = join(repoRoot, 'coverage', 'lcov.info');

/** Minimum line/function coverage per workspace unit (percent, 0-100). */
const THRESHOLDS: Readonly<Record<string, { readonly lines: number; readonly functions: number }>> = {
  'packages/ai-mcp': { lines: 85, functions: 59 },
  'packages/auth': { lines: 94, functions: 90 },
  'packages/cache': { lines: 89, functions: 89 },
  'packages/cli': { lines: 43, functions: 40 },
  'packages/core': { lines: 90, functions: 90 },
  'packages/crud': { lines: 91, functions: 88 },
  'packages/database': { lines: 85, functions: 83 },
  'packages/events': { lines: 95, functions: 92 },
  'packages/http': { lines: 95, functions: 64 },
  'packages/logging': { lines: 98, functions: 93 },
  'packages/mail': { lines: 92, functions: 87 },
  'packages/notifications': { lines: 94, functions: 91 },
  'packages/openapi': { lines: 99, functions: 99 },
  'packages/queue': { lines: 86, functions: 84 },
  'packages/scheduler': { lines: 84, functions: 93 },
  'packages/storage': { lines: 91, functions: 95 },
  'packages/support': { lines: 97, functions: 88 },
  'packages/testing': { lines: 99, functions: 82 },
  'packages/validation': { lines: 99, functions: 99 },
  'packages/workflow': { lines: 89, functions: 85 },
  'apps/playground': { lines: 91, functions: 66 },
};

function print(line: string) {
  process.stdout.write(`${line}\n`);
}

const ratio = (hit: number, found: number): number => (found === 0 ? Number.NaN : hit / found);

interface LcovRecord {
  readonly file: string;
  linesHit: number;
  linesFound: number;
  functionsHit: number;
  functionsFound: number;
}

function parseLcov(): Map<string, LcovRecord> {
  const units = new Map<string, LcovRecord>();
  const unitFor = (file: string): string | undefined => {
    const match = /^(packages\/[^/]+|apps\/[^/]+)\//.exec(file);
    return match?.[1];
  };
  let current:
    | { readonly unit: string; linesHit: number; linesFound: number; functionsHit: number; functionsFound: number }
    | undefined;
  const flush = () => {
    if (!current) return;
    const unit = units.get(current.unit) ?? {
      file: current.unit,
      linesHit: 0,
      linesFound: 0,
      functionsHit: 0,
      functionsFound: 0,
    };
    unit.linesHit += current.linesHit;
    unit.linesFound += current.linesFound;
    unit.functionsHit += current.functionsHit;
    unit.functionsFound += current.functionsFound;
    units.set(current.unit, unit);
    current = undefined;
  };

  for (const line of readFileSync(LCOV, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) {
      const unit = unitFor(line.slice(3).trim());
      flush();
      if (unit) current = { unit, linesHit: 0, linesFound: 0, functionsHit: 0, functionsFound: 0 };
    } else if (current && line.startsWith('LF:')) {
      current.linesFound = Number(line.slice(3));
    } else if (current && line.startsWith('LH:')) {
      current.linesHit = Number(line.slice(3));
    } else if (current && line.startsWith('FNF:')) {
      current.functionsFound = Number(line.slice(4));
    } else if (current && line.startsWith('FNH:')) {
      current.functionsHit = Number(line.slice(4));
    } else if (line.startsWith('end_of_record')) {
      flush();
    }
  }
  flush();
  return units;
}

const report = process.argv.includes('--report');

rmSync(join(repoRoot, 'coverage'), { recursive: true, force: true });
const run = spawnSync('bun', ['test', '--coverage', '--coverage-reporter=lcov', './packages', './apps'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (run.status !== 0) {
  print('coverage: the test suite failed; fix the suite before gating coverage');
  process.exit(run.status ?? 1);
}

const units = parseLcov();
print('');
print('Package coverage (lines / functions)');
print('------------------------------------');
const failures: string[] = [];
const rows = Object.keys(THRESHOLDS).sort();
for (const unit of rows) {
  const measured = units.get(unit);
  const threshold = THRESHOLDS[unit];
  if (!measured) {
    print(`${unit.padEnd(24)} no coverage recorded`);
    failures.push(`${unit}: no coverage recorded (no test imported its sources?)`);
    continue;
  }
  const lines = ratio(measured.linesHit, measured.linesFound) * 100;
  const functions = ratio(measured.functionsHit, measured.functionsFound) * 100;
  if (!Number.isFinite(lines) || !Number.isFinite(functions)) {
    print(`${unit.padEnd(24)} no coverage recorded`);
    failures.push(`${unit}: coverage totals were zero (instrumentation produced no records?)`);
    continue;
  }
  const lineDisplay = lines.toFixed(1).padStart(5);
  const fnDisplay = functions.toFixed(1).padStart(5);
  print(`${unit.padEnd(24)} ${lineDisplay}% / ${fnDisplay}%`);
  if (!report) {
    if (lines < threshold.lines) failures.push(`${unit}: lines ${lines.toFixed(1)}% < ${threshold.lines}%`);
    if (functions < threshold.functions) {
      failures.push(`${unit}: functions ${functions.toFixed(1)}% < ${threshold.functions}%`);
    }
  }
}

const unmeasured = [...units.keys()].filter((unit) => !rows.includes(unit));
for (const unit of unmeasured.sort()) print(`${unit.padEnd(24)} (outside the gate)`);

print('');
if (report) {
  print('report mode: no thresholds enforced');
  process.exit(0);
}
if (failures.length > 0) {
  for (const failure of failures) print(`FAIL ${failure}`);
  process.exit(1);
}
print('coverage gate passed');
