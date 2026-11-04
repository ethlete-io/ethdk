import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { appSpecProblemsOf, specFailuresOf } from './app-spec';

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
