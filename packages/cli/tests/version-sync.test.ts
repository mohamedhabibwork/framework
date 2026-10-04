import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../../..');

/** The generated-app template pins this so `cli --version` reports truthfully. */
const TEMPLATE_PATH = join(ROOT, 'packages/cli/src/generators/app/templates.ts');

describe('version sync', () => {
  test('generated-app template frameworkVersion matches the root package version', () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
    const pins = [...readFileSync(TEMPLATE_PATH, 'utf8').matchAll(/frameworkVersion:\s*'([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) {
      expect(pin).toBe(version);
    }
  });
});
