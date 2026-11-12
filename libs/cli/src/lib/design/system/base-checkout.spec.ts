import { existsSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { picturesDirOf } from './base-checkout';

describe('picturesDirOf', () => {
  it('takes the same emptied folder on each run, so runs do not pile up folders in the temp dir', () => {
    const first = picturesDirOf({ root: '/repo', product: 'sdk' });

    writeFileSync(join(first, 'old.diff.png'), '');

    const second = picturesDirOf({ root: '/repo', product: 'sdk' });

    expect(second).toBe(first);
    expect(existsSync(join(second, 'old.diff.png'))).toBe(false);
    expect(readdirSync(tmpdir()).filter((name) => name.startsWith('et-design-visible-change'))).toEqual([
      'et-design-visible-change',
    ]);
  });
});
