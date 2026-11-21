import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { appSpecProblemsOf, specFailuresOf, specSeedsOf } from './app-spec';

const report = readFileSync(join(__dirname, 'app-spec.vitest-related.json'), 'utf8');

describe('specFailuresOf', () => {
  it('names each failed spec with its failed tests, or the load error of a spec that did not run', () => {
    expect(specFailuresOf({ root: '/tmp/s3cap', report })).toEqual([
      { file: 'src/chip.spec.ts', failed: ['chip draws'] },
      { file: 'src/tag.spec.ts', failed: ["Cannot find module './missing' imported from /tmp/s3cap/src/tag.spec.ts"] },
    ]);
  });
});

describe('appSpecProblemsOf', () => {
  const failures = specFailuresOf({ root: '/tmp/s3cap', report });

  it('puts a failing spec of a part component on that part, not on the page that embeds it', () => {
    const problems = appSpecProblemsOf({
      parts: [
        { part: 'pages/home', files: ['src/home.ts', 'src/chip.ts'] },
        { part: 'components/chip', files: ['src/chip.ts'] },
      ],
      failures,
    });

    expect(problems.get('components/chip')).toEqual([
      { rule: 'APP-SPEC', file: 'src/chip.spec.ts', message: 'fails: chip draws' },
    ]);
    expect(problems.get('pages/home')).toBeUndefined();
  });

  it('puts a failing spec no checked part reaches on (product)', () => {
    const problems = appSpecProblemsOf({ parts: [{ part: 'components/chip', files: ['src/chip.ts'] }], failures });

    expect(problems.get('(product)')?.map((problem) => problem.file)).toEqual(['src/tag.spec.ts']);
  });
});

describe('specSeedsOf', () => {
  const root = mkdtempSync(join(tmpdir(), 'spec-seeds-'));

  mkdirSync(join(root, 'app/i18n'), { recursive: true });
  writeFileSync(join(root, 'app/i18n/labels.ts'), '');
  writeFileSync(join(root, 'app/i18n/labels.spec.ts'), '');
  writeFileSync(join(root, 'app/i18n/plain.ts'), '');

  it('keeps part files and swaps a shared file for its own spec', () => {
    expect(
      specSeedsOf({
        root,
        files: ['app/part/part.ts', 'app/i18n/labels.ts', 'app/i18n/plain.ts'],
        shared: ['app/i18n/**'],
      }),
    ).toEqual(['app/part/part.ts', 'app/i18n/labels.spec.ts']);
  });
});
