import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { orphanEndpointsOf } from './orphan-endpoint';

const checkoutWith = (files: Record<string, string>) => {
  const checkout = mkdtempSync(join(tmpdir(), 'cli-orphan-'));

  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(checkout, path, '..'), { recursive: true });
    writeFileSync(join(checkout, path), text);
  }

  return checkout;
};

const served = ['/__design/comment', '/__design/comments', '/__design/comment-done'];

describe('orphanEndpointsOf', () => {
  it('flags exactly the served path no app source calls', () => {
    const checkout = checkoutWith({
      'app/src/host/design.ts':
        "const a = `http://h/__design/comments?x=1`; const b = (path: string) => `/__design/${path}`; u({ path: 'comment-done' }); const c = 'comment';",
    });

    const found = orphanEndpointsOf({ served, appDir: join(checkout, 'app/src'), checkout });

    expect(found.map(({ rule, message }) => `${rule} ${message}`)).toEqual([
      'ORPHAN-ENDPOINT /__design/comment: served by the design CLI, called nowhere in app/src',
    ]);
  });

  it('ignores a spec file and an app that never talks to the design server', () => {
    const calling = checkoutWith({
      'app/src/host/design.ts': "fetch('/__design/system');",
      'app/src/host/design.spec.ts': "fetch('/__design/comment');",
    });
    const other = checkoutWith({ 'app/src/main.ts': 'export {};' });

    expect(orphanEndpointsOf({ served, appDir: join(calling, 'app/src'), checkout: calling })).toHaveLength(3);
    expect(orphanEndpointsOf({ served, appDir: join(other, 'app/src'), checkout: other })).toEqual([]);
  });
});
