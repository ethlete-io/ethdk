import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { systemWarningOf } from './system-use';

const checkout = (variant: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));
  const folder = join(target, '.ethlete/design/calls/app/pages/00-home');

  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'variant-a.ts'), variant);

  return target;
};

describe('systemWarningOf', () => {
  it('warns about a page call that imports nothing from the design system', () => {
    const target = checkout(`import { html } from '@design-explore';\nimport { row } from '../shared';\n`);

    expect(systemWarningOf({ target, slug: 'app/pages/00-home', stage: 'page' })).toContain(
      'no variant imports from .ethlete/design/system/app/',
    );
  });

  it('stays quiet when a variant imports a design-system entry of its project', () => {
    const target = checkout(`import { card } from '../../../../system/app/card/card';\n`);

    expect(systemWarningOf({ target, slug: 'app/pages/00-home', stage: 'page' })).toBeNull();
  });

  it('warns when the import reaches the design system of another project', () => {
    const target = checkout(`import { card } from '../../../../system/other/card/card';\n`);

    expect(systemWarningOf({ target, slug: 'app/pages/00-home', stage: 'prototype' })).not.toBeNull();
  });

  it('leaves loose calls and the stages before the system alone', () => {
    const target = checkout('');

    expect(systemWarningOf({ target, slug: 'app/pages/00-home', stage: null })).toBeNull();
    expect(systemWarningOf({ target, slug: 'app/pages/00-home', stage: 'component' })).toBeNull();
  });
});
