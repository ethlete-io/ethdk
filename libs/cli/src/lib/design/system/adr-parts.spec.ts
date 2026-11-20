import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { planQuestionsOf, unbuiltAdrPartsOf } from './adr-parts';

const adr = (front: string) => `---\n${front}\n---\n\n# Title\n`;

describe('unbuiltAdrPartsOf', () => {
  it('names each part of an ADR without built', () => {
    expect(unbuiltAdrPartsOf(adr('status: accepted\nopen: B1\nparts: [components/a, elements/b]'))).toEqual([
      'components/a',
      'elements/b',
    ]);
  });

  it('names none once the ADR is built or has no parts', () => {
    expect(unbuiltAdrPartsOf(adr('status: accepted\nbuilt: 409246e68\nparts: [components/a]'))).toEqual([]);
    expect(unbuiltAdrPartsOf(adr('status: accepted\nopen: B1'))).toEqual([]);
  });
});

describe('planQuestionsOf', () => {
  it('reads one question per part of an unbuilt ADR under apps/*/docs/adr', () => {
    const root = mkdtempSync(join(tmpdir(), 'adr-parts-'));
    const dir = join(root, 'apps', 'studio', 'docs', 'adr');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '0400-open.md'), adr('status: accepted\nopen: B1\nparts: [components/a, elements/b]'));
    writeFileSync(join(dir, '0401-done.md'), adr('status: accepted\nbuilt: 409246e68\nparts: [components/c]'));

    expect(planQuestionsOf(root)).toEqual([
      { part: 'components/a', adr: '0400' },
      { part: 'elements/b', adr: '0400' },
    ]);
  });
});
