import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { uncoveredRegionProblemsOf } from './uncovered-region';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-uncovered-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
};

const region = { element: '<div class="promo">', component: 'app-home', box: { x: 0, y: 0, width: 40, height: 20 } };

describe('uncoveredRegionProblemsOf', { timeout: 30_000 }, () => {
  it('puts a region under a page part on that part, once for every state that shows it', () => {
    const problems = uncoveredRegionProblemsOf({
      product: acme(),
      live: 'apps/acme/design-live.json',
      states: [
        { page: 'pages/home', state: 'default', regions: [region] },
        { page: 'pages/home', state: 'empty', regions: [region] },
      ],
    });

    expect([...problems.keys()]).toEqual(['pages/home']);
    expect(problems.get('pages/home')).toEqual([
      {
        rule: 'UNCOVERED-REGION',
        file: 'apps/acme/design-live.json',
        message: expect.stringMatching(/^pages\/home default, pages\/home empty: <div class="promo"> in <app-home>/u),
      },
    ]);
  });

  it('puts a region of a live page no part hosts on (product)', () => {
    const problems = uncoveredRegionProblemsOf({
      product: acme(),
      live: 'apps/acme/design-live.json',
      states: [{ page: 'pages/gone', state: 'default', regions: [region] }],
    });

    expect([...problems.keys()]).toEqual(['(product)']);
  });

  it('reports a live state that did not open as a problem on its page', () => {
    const problems = uncoveredRegionProblemsOf({
      product: acme(),
      live: 'apps/acme/design-live.json',
      states: [{ page: 'pages/home', state: 'default', problem: 'no element .shell' }],
    });

    expect(problems.get('pages/home')?.[0]?.message).toBe(
      'pages/home default: the live page did not open: no element .shell',
    );
  });
});
