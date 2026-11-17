import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../design-config';
import { renderIssuesOf } from './render-check';

const REPO = resolve(__dirname, '../../../../../..');

describe('a real Studio part drawn from source', () => {
  it('draws every state of an ng() part through the render worker', async () => {
    const config = readConfig(REPO);

    if (!config) throw new Error(`${REPO} has no design config`);

    const result = await renderIssuesOf({
      target: REPO,
      config,
      jobs: [{ product: 'studio', sketch: null, parts: ['components/update-dialog'] }],
    });

    if ('unavailable' in result) throw new Error(result.unavailable);

    expect(result.issues.filter((issue) => issue.rule === 'RENDER')).toEqual([]);
    expect(result.drawn.length).toBeGreaterThan(0);
  }, 300_000);
});
