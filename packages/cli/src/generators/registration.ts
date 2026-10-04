import { failure } from '../errors';

/**
 * Adds an import statement after the last top-level import (syntax-aware:
 * multi-line imports are respected). Idempotent for identical statements.
 */
export function addImport(source: string, statement: string): string {
  if (source.includes(statement)) return source;
  const lines = source.split('\n');
  let lastImportEnd = -1;
  let inImport = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] as string;
    if (!inImport && /^import\s/.test(line)) inImport = true;
    if (inImport && /;\s*$/.test(line)) {
      inImport = false;
      lastImportEnd = index;
    }
  }
  lines.splice(lastImportEnd + 1, 0, statement);
  return lines.join('\n');
}

/**
 * Inserts `line` directly after the explicit registration marker
 * `// <marker>`, keeping the marker's indentation. Missing markers and
 * duplicate registrations are errors, never silent text insertion.
 */
export function insertAfterMarker(source: string, marker: string, line: string, file: string): string {
  const lines = source.split('\n');
  const index = lines.findIndex((l) => l.trim() === `// ${marker}`);
  if (index === -1) {
    throw failure(
      'REGISTRATION_MARKER_MISSING',
      `Marker "// ${marker}" not found in ${file}`,
      'Restore the marker comment so generators can register modules explicitly.',
    );
  }
  if (lines.some((l) => l.trim() === line.trim())) {
    throw failure('ALREADY_REGISTERED', `${file} already contains: ${line.trim()}`);
  }
  const indentation = (lines[index] as string).match(/^\s*/)?.[0] ?? '';
  lines.splice(index + 1, 0, `${indentation}${line.trim()}`);
  return lines.join('\n');
}
