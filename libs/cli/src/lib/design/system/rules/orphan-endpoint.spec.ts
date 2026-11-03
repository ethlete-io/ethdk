import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { orphanEndpointsOf, orphanEndpointVerdictOf } from './orphan-endpoint';
import { KNOWN_ORPHAN_ENDPOINTS, KnownOrphan } from './orphan-endpoint-known';

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

describe('orphanEndpointVerdictOf', () => {
  const verdictOf = (source: string, known: KnownOrphan[]) => {
    const checkout = checkoutWith({ 'app/src/host/design.ts': source });

    return orphanEndpointVerdictOf({ served, appDir: join(checkout, 'app/src'), checkout, known });
  };
  const calls = "fetch('/__design/comments'); fetch('/__design/comment-done');";
  const textsOf = (problems: { message: string }[]) => problems.map(({ message }) => message);

  it('warns once for a listed orphan and does not fail', () => {
    const { errors, warnings } = verdictOf(calls, [
      { path: '/__design/comment', backlog: 'B145', state: { kind: 'never-written' } },
    ]);

    expect(errors).toEqual([]);
    expect(textsOf(warnings)).toEqual(['/__design/comment: orphan endpoint, known and tracked in B145']);
  });

  it('fails an orphan that is not listed', () => {
    const { errors, warnings } = verdictOf(calls, []);

    expect(textsOf(errors)).toEqual(['/__design/comment: served by the design CLI, called nowhere in app/src']);
    expect(warnings).toEqual([]);
  });

  it('fails a listed path that has a caller again', () => {
    const { errors, warnings } = verdictOf(`${calls} fetch('/__design/comment');`, [
      { path: '/__design/comment', backlog: 'B145', state: { kind: 'never-written' } },
    ]);

    expect(textsOf(errors)).toEqual([
      '/__design/comment: listed as never written (B145) but it has a caller again - remove it from KNOWN_ORPHAN_ENDPOINTS',
    ]);
    expect(warnings).toEqual([]);
  });
});

describe('a known entry written by a function', () => {
  const entry: KnownOrphan = {
    path: '/__design/comment',
    backlog: 'B195',
    state: { kind: 'written-by', writer: 'writeComment$' },
  };
  const helper = 'const productUrl = (a: string, path: string) => `http://h/__design/${path}?product=${a}`;';
  const writer = "export const writeComment$ = (a: string) => post(productUrl(a, 'comment'));";
  const verdictOf = (files: Record<string, string>) => {
    const checkout = checkoutWith(files);

    return orphanEndpointVerdictOf({
      served: ['/__design/comment'],
      appDir: join(checkout, 'app/src'),
      checkout,
      known: [entry],
    });
  };
  const textsOf = (problems: { message: string }[]) => problems.map(({ message }) => message);

  it('stays silent while the writer exists and the app calls it', () => {
    const { errors, warnings } = verdictOf({
      'app/src/host/design.ts': `${helper}\n${writer}`,
      'app/src/app/store.ts': "import { writeComment$ } from '../host/design';\nwriteComment$('x');",
    });

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('fails when the writer was removed', () => {
    const { errors } = verdictOf({
      'app/src/host/design.ts': `${helper}\nexport const listed$ = (a: string) => get(productUrl(a, 'comments'));`,
      'app/src/app/store.ts': "import { listed$ } from '../host/design';\nlisted$('x');",
    });

    expect(textsOf(errors)).toEqual([
      '/__design/comment: listed as written by writeComment$, which no longer exists in app/src - fix the entry or call the endpoint again',
    ]);
  });

  it('fails when the writer lost its app caller', () => {
    const { errors } = verdictOf({
      'app/src/host/design.ts': `${helper}\n${writer}`,
      'app/src/app/store.ts': "import { writeComment$ } from '../host/design';",
    });

    expect(textsOf(errors)).toEqual([
      '/__design/comment: listed as written by writeComment$, which no app file calls any more - fix the entry or call the writer again',
    ]);
  });
});

describe('a bare segment passed to a url helper', () => {
  const comments = [
    '/__design/comments',
    '/__design/comment',
    '/__design/comment-reply',
    '/__design/comment-done',
    '/__design/comment-withdraw',
  ];
  const host = [
    'const productUrl = (a: string, path: string) => `http://h/__design/${path}?product=${a}`;',
    "export const listed$ = (a: string) => get(productUrl(a, 'comments'));",
    "export const writeComment$ = (a: string) => post(productUrl(a, 'comment'));",
  ].join('\n');
  const orphansOf = (files: Record<string, string>) => {
    const checkout = checkoutWith(files);

    return orphanEndpointsOf({ served: comments, appDir: join(checkout, 'app/src'), checkout }).map(({ message }) =>
      message.slice(0, message.indexOf(':')),
    );
  };

  it('does not count the host function that writes it when no app file calls that function', () => {
    expect(
      orphansOf({
        'app/src/host/design.ts': host,
        'app/src/app/store.ts': "import { listed$ } from '../host/design';\nlisted$('x');",
      }),
    ).toEqual(['/__design/comment', '/__design/comment-reply', '/__design/comment-done', '/__design/comment-withdraw']);
  });

  it('counts it once an app file calls the host function', () => {
    expect(
      orphansOf({
        'app/src/host/design.ts': host,
        'app/src/app/store.ts':
          "import { listed$, writeComment$ } from '../host/design';\nlisted$('x');\nwriteComment$('x');",
      }),
    ).toEqual(['/__design/comment-reply', '/__design/comment-done', '/__design/comment-withdraw']);
  });

  it('does not count an import as a call', () => {
    expect(
      orphansOf({
        'app/src/host/design.ts': host,
        'app/src/app/store.ts': "import { listed$, writeComment$ } from '../host/design';\nlisted$('x');",
      }),
    ).toContain('/__design/comment');
  });

  it('keeps the three unwritten comment endpoints on the known list under B189', () => {
    expect(KNOWN_ORPHAN_ENDPOINTS.filter(({ backlog }) => backlog === 'B189').map(({ path }) => path)).toEqual([
      '/__design/comment-done',
      '/__design/comment-withdraw',
      '/__design/comment-reply',
    ]);
  });
});

describe('the Studio app tree of 8cf715654', () => {
  const studioApiEndpoints = [
    '/__design/comment',
    '/__design/comment-reply',
    '/__design/comment-done',
    '/__design/comment-withdraw',
  ];
  const repo = join(__dirname, '../../../../../../..');
  const treeOf = (commit: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-orphan-tree-'));

    try {
      const archive = execFileSync('git', ['archive', commit, 'apps/ethlete-studio/src'], {
        cwd: repo,
        maxBuffer: 1 << 28,
      });

      execFileSync('tar', ['-x', '-C', dir], { input: archive });

      return dir;
    } catch {
      return null;
    }
  };
  const tree = treeOf('8cf715654');

  it.skipIf(!tree)('reports comment, reply, done and withdraw', () => {
    const found = orphanEndpointsOf({
      served: studioApiEndpoints,
      appDir: join(tree as string, 'apps/ethlete-studio/src'),
      checkout: tree as string,
    });

    expect(found.map(({ message }) => message.slice(0, message.indexOf(':')))).toEqual(studioApiEndpoints);
  });
});
