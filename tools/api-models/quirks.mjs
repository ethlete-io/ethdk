#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Known defects of the API model generator, corrected by exact text edits before normalize.mjs runs.
 * A quirk applies when every `find` occurs in `file`, is skipped when none does, and fails the import when only
 * some do, because then the generator output changed shape and the edit needs a review.
 */
export const QUIRKS = [
  {
    file: 'Participant/participantList.view.ts',
    reason: 'The generator types footballClub as ClubView, which it never emits.',
    edits: [
      ["import { ClubView } from './club.view';", "import { ClubListView } from '../Club';"],
      ['footballClub: ClubView | null;', 'footballClub: ClubListView | null;'],
    ],
  },
  {
    file: 'index.ts',
    reason: 'The generator derives the root export name from lineupPlayerV.view.ts and drops the 2.',
    edits: [['{ LineupPlayerVView }', '{ LineupPlayerV2View }']],
  },
];

export const applyQuirks = (root, quirks = QUIRKS) => {
  const dir = resolve(root);
  const report = { applied: [], skipped: [] };

  for (const quirk of quirks) {
    const path = join(dir, quirk.file);
    const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const matches = quirk.edits.filter(([find]) => source.includes(find));

    if (!matches.length) {
      report.skipped.push(quirk);
      continue;
    }
    if (matches.length !== quirk.edits.length) {
      const missing = quirk.edits.filter(([find]) => !source.includes(find)).map(([find]) => find);
      throw new Error(`Quirk for ${quirk.file} matches only partly. Missing: ${missing.join(' | ')}`);
    }

    writeFileSync(
      path,
      quirk.edits.reduce((text, [find, replacement]) => text.replaceAll(find, replacement), source),
    );
    report.applied.push(quirk);
  }
  return report;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [dir] = process.argv.slice(2);
  if (!dir) {
    process.stderr.write('Usage: quirks.mjs <dir>\n');
    process.exit(1);
  }
  const { applied, skipped } = applyQuirks(dir);
  for (const quirk of applied) process.stdout.write(`Applied quirk ${quirk.file}: ${quirk.reason}\n`);
  for (const quirk of skipped) {
    process.stdout.write(`::notice::Quirk ${quirk.file} does not apply. Remove it once no API branch needs it.\n`);
  }
}
