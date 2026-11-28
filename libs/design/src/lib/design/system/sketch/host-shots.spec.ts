import { cpSync, mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { createSystemModules } from '../system-modules';
import { hostPagesOf } from './host-shots';

const acme = () => {
  const target = realpathSync(mkdtempSync(join(tmpdir(), 'cli-design-host-shots-')));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const product = createSystemModules({ target, config: readConfig(target) ?? {} }).productOf('acme');

  if (!product) throw new Error('no acme');

  return product;
};

describe('the host pages a sketch is also shot in', () => {
  it('lists each page that embeds a sketched part, directly or through another part', () => {
    expect(hostPagesOf({ product: acme(), sketch: { targets: ['components/button'] } })).toEqual(['pages/home']);
  });

  it('lists no page for a part no page embeds, and none for a tokens part', () => {
    const product = acme();

    expect(hostPagesOf({ product, sketch: { targets: ['foundations/palette'] } })).toEqual([]);
    expect(hostPagesOf({ product, sketch: { targets: ['foundations/tokens'] } })).toEqual([]);
  });

  it('does not list the sketched page itself', () => {
    expect(hostPagesOf({ product: acme(), sketch: { targets: ['pages/home'] } })).toEqual([]);
  });
});
