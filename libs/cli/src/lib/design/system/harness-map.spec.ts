import { execFileSync } from 'child_process';
import { originOf } from './write-origin';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignHarness, DESIGN_DIR, readConfig } from '../design-config';
import { designCompare } from './compare-command';
import { harnessProblemOf } from './harness-config';
import { designHarness } from './harness-command';
import { Readable } from 'stream';
import { IncomingMessage } from 'http';
import { partGoAnswer } from '../studio-api';
import { goStepOf } from './go-step';
import { goMarkOf, goPartOf } from './part-go';
import { writePartRecord } from './part-ready';
import { resolveProduct } from './resolve-product';
import { designTask } from './task-command';
import { checkSystemRendered } from './check-system';
import { designReady } from './ready-command';

const HARNESS: DesignHarness = { app: 'apps/app-a', map: 'apps/app-a/src/harness/parts.ts' };

const component = (name: string) =>
  `import { Component } from '@angular/core';\n\n@Component({ selector: 'x-${name}', template: '' })\nexport class ${name}Component {}\n\nexport const helper = 1;\n`;

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-harness-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), source);
  };
  const part = (path: string, source: string) =>
    write(join(DESIGN_DIR, 'app-a', path, `${path.split('/')[1]}.ts`), source);

  write('.prettierrc', '{ "singleQuote": true, "printWidth": 120 }');
  write('libs/chip/chip.component.ts', component('Chip'));
  write('apps/app-a/src/outbox/outbox.component.ts', component('Outbox'));
  part(
    'components/chip',
    "export default definePart({ implements: 'libs/chip/chip.component.ts', states: { default: {} } });\n",
  );
  part('components/tag', 'export default definePart({ states: { default: {} } });\n');
  part('pages/inbox', "export default definePart({ implements: { route: '/inbox' }, states: { default: {} } });\n");
  part(
    'pages/outbox',
    "export default definePart({ implements: { route: '/outbox', component: 'apps/app-a/src/outbox/outbox.component.ts' }, states: { default: {} } });\n",
  );
  write(join(DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': { harness: HARNESS } } }));

  return { target, map: join(target, HARNESS.map), write };
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const harness = (target: string, ...argv: string[]) =>
  designHarness({ target, argv: ['--product', 'app-a', ...argv], invocation: 'et design' });

describe('harness config', () => {
  it('accepts app and map repo paths with the map inside the app', () => {
    expect(harnessProblemOf(HARNESS)).toBeNull();
    expect(harnessProblemOf({ ...HARNESS, shared: ['apps/app-a/src/i18n/**'] })).toBeNull();
    expect(harnessProblemOf({ ...HARNESS, live: 'apps/app-a/design-live.json' })).toBeNull();
  });

  it.each([
    ['apps/app-a', 'harness must be'],
    [{ map: 'apps/a/parts.ts' }, 'harness.app must be a repo path'],
    [{ app: '/abs/app', map: 'apps/a/parts.ts' }, 'harness.app must be a repo path'],
    [{ app: 'apps/a', map: 'apps/a/parts.json' }, 'harness.map must be the repo path of a .ts file'],
    [{ app: 'apps/a', map: '../outside/parts.ts' }, 'harness.map must be the repo path of a .ts file'],
    [{ app: 'apps/a', map: 'apps/b/parts.ts' }, 'must lie inside harness.app'],
    [{ app: 'apps/a', map: 'apps/a/parts.ts', shared: 'apps/a/i18n/**' }, 'harness.shared must be a list'],
    [{ app: 'apps/a', map: 'apps/a/parts.ts', shared: ['apps/b/i18n/**'] }, 'harness.shared "apps/b/i18n/**" must be'],
    [{ app: 'apps/a', map: 'apps/a/parts.ts', live: 'apps/b/live.json' }, 'harness.live must be'],
    [{ app: 'apps/a', map: 'apps/a/parts.ts', live: 'apps/a/live.ts' }, 'harness.live must be'],
    [{ app: 'apps/a', map: 'apps/a/parts.ts', hosts: 'DesignCanvas' }, 'harness.hosts must be a list'],
    [{ app: 'apps/a', map: 'apps/a/parts.ts', hosts: ['Design Canvas'] }, 'harness.hosts must be a list'],
  ])('refuses %j', (value, message) => {
    expect(harnessProblemOf(value)).toContain(message);
  });

  it('reports an unusable harness as a product problem', () => {
    const { target } = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: { harness: { app: 'apps/a' } as never } });

    expect(product.problems.map((problem) => problem.rule)).toContain('HARNESS');
  });
});

describe('et design harness', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes a sorted lazy import per component link and skips route-only and unlinked parts', () => {
    const lines = output();
    const { target, map } = checkout();

    expect(harness(target)).toBe(0);
    expect(lines).toEqual(['wrote apps/app-a/src/harness/parts.ts']);
    expect(readFileSync(map, 'utf8')).toBe(
      [
        "// Generated by `et design harness --product app-a` from the parts' implements links. Do not edit.",
        "import { Type } from '@angular/core';",
        '',
        'export const DESIGN_HARNESS_PARTS: Record<string, () => Promise<Type<unknown>>> = {',
        "  'components/chip': () => import('../../../../libs/chip/chip.component').then((m) => m.ChipComponent),",
        "  'pages/outbox': () => import('../outbox/outbox.component').then((m) => m.OutboxComponent),",
        '};',
        '',
      ].join('\n'),
    );
  });

  it('writes an empty map when no part links a component, and leaves a current map alone', () => {
    const lines = output();
    const { target, map, write } = checkout();

    write(join(DESIGN_DIR, 'app-a/components/chip/chip.ts'), 'export default definePart({ states: {} });\n');
    write(join(DESIGN_DIR, 'app-a/pages/outbox/outbox.ts'), 'export default definePart({ states: {} });\n');

    expect(harness(target)).toBe(0);
    expect(readFileSync(map, 'utf8')).toContain('Promise<Type<unknown>>> = {};\n');
    expect(harness(target)).toBe(0);
    expect(lines.at(-1)).toBe('apps/app-a/src/harness/parts.ts is current');
  });

  it('--check exits 1 for a missing or changed map without writing, and 0 for a current one', () => {
    const lines = output();
    const { target, map, write } = checkout();

    expect(harness(target, '--check')).toBe(1);
    expect(existsSync(map)).toBe(false);
    expect(lines.at(-1)).toBe('apps/app-a/src/harness/parts.ts is stale - run et design harness --product app-a');

    expect(harness(target)).toBe(0);
    expect(harness(target, '--check')).toBe(0);

    write(
      join(DESIGN_DIR, 'app-a/components/tag/tag.ts'),
      "export default definePart({ implements: 'libs/chip/chip.component.ts' });\n",
    );

    expect(harness(target, '--check')).toBe(1);
    expect(readFileSync(map, 'utf8')).not.toContain('components/tag');
  });

  it('refuses a product without a harness, and a link whose file exports no component', () => {
    const lines = output();

    const bare = checkout();

    bare.write(join(DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

    expect(harness(bare.target)).toBe(1);
    expect(lines.at(-1)).toBe('product "app-a" declares no harness in config.json');

    const { target, map, write } = checkout();

    write('libs/chip/chip.component.ts', 'export const chip = 1;\n');

    expect(harness(target)).toBe(1);
    expect(lines.at(-1)).toContain(
      'components/chip implements libs/chip/chip.component.ts, which exports no @Component',
    );
    expect(existsSync(map)).toBe(false);
  });

  it('makes compare and task --verify refuse a stale map', async () => {
    const lines = output();
    const { target } = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: { harness: HARNESS } });
    const compare = vi.fn(async () => ({ green: true, states: {} }));
    const shoot = vi.fn(async () => 'shoot must not run');

    expect(writePartRecord({ product, part: 'components/chip', origin: originOf('spec') })).not.toBeNull();

    const stale = 'the harness map apps/app-a/src/harness/parts.ts is stale - run et design harness --product app-a';
    const argv = ['components/chip', '--product', 'app-a', '--url', 'http://localhost:1'];

    expect(await designCompare({ target, argv, invocation: 'et design', shoot })).toBe(1);
    expect(lines.at(-1)).toBe(stale);
    expect(shoot).not.toHaveBeenCalled();

    expect(
      await designTask({
        target,
        argv: [...argv, '--verify'],
        invocation: 'et design',
        load: async () => ({ default: {} }),
        diff: () => [],
        compare,
      }),
    ).toBe(1);
    expect(lines.at(-1)).toBe(stale);
    expect(compare).not.toHaveBeenCalled();
  });
});

describe('task --verify and the app stylesheet', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows only @source line changes in the global stylesheet the harness app builds with', async () => {
    const lines = output();
    const { target, write } = checkout();
    const stylesheet = 'apps/app-a/src/styles.css';
    const patch = (body: string) =>
      `diff --git a/${stylesheet} b/${stylesheet}\n--- a/${stylesheet}\n+++ b/${stylesheet}\n@@ -3 +3 @@\n${body}`;
    const verify = (changes: string) =>
      designTask({
        target,
        argv: ['components/chip', '--product', 'app-a', '--url', 'http://localhost:1', '--verify'],
        invocation: 'et design',
        load: async () => ({ default: {} }),
        diff: () => [stylesheet, 'libs/chip/chip.component.ts'],
        patch: () => patch(changes),
        compare: vi.fn(async () => ({ green: true, states: {} })),
        actions: vi.fn(async () => []),
      });

    write('apps/app-a/project.json', JSON.stringify({ targets: { build: { options: { styles: [stylesheet] } } } }));
    expect(harness(target)).toBe(0);
    expect(
      writePartRecord({
        product: resolveProduct({ target, name: 'app-a', config: { harness: HARNESS } }),
        part: 'components/chip',
        origin: originOf('spec'),
      }),
    ).not.toBeNull();

    expect(await verify("-@source inline('w-12');\n+@source inline('w-12 w-128');\n")).toBe(0);
    expect(await verify("-@source inline('w-12');\n+@source inline('w-12');\n+body { margin: 0; }\n")).toBe(1);
    expect(lines).toContain(`  ${stylesheet}`);
  });
});

describe('design check and design ready with a stale harness map', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('design check regenerates the stale map', async () => {
    vi.stubEnv('CI', '1');
    const lines = output();
    const { target, map } = checkout();

    await checkSystemRendered({
      target,
      config: readConfig(target) ?? {},
      products: ['app-a'],
      part: 'components/chip',
      chromiumOf: async () => null,
    });

    expect(readFileSync(map, 'utf8')).toContain("'components/chip'");
    expect(lines).toContain('REGENERATED app-a: the stale harness map');
    expect(harness(target, '--check')).toBe(0);
  }, 60_000);

  it('design ready regenerates the stale map, and refuses with the regenerate command when it cannot write it', async () => {
    const lines = output();
    const { target, map } = checkout();
    const ready = () =>
      designReady({
        target,
        argv: ['components/nope', '--product', 'app-a', '--by', 'model'],
        invocation: 'et design',
      });

    await ready();

    expect(readFileSync(map, 'utf8')).toContain("'components/chip'");
    expect(lines).toContain('regenerated the stale harness map');

    const blocked = checkout();

    blocked.write('apps/app-a/src/harness/parts.ts/blocker', '');

    expect(
      await designReady({
        target: blocked.target,
        argv: ['components/chip', '--product', 'app-a', '--by', 'model'],
        invocation: 'et design',
      }),
    ).toBe(1);
    expect(lines.join('\n')).toContain('run et design harness --product app-a');
  });
});

describe('design go with a stale harness map', () => {
  afterEach(() => vi.restoreAllMocks());

  const goOf = (target: string, write: (path: string, source: string) => void) => {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: target, stdio: 'ignore' });

    write('plans/decisions.md', '- Impl Q9 the chip may go\n');
    git('init', '-q');
    git('add', 'plans');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'decision');

    const step = goStepOf({
      target,
      product: 'app-a',
      part: 'components/chip',
      by: 'tom',
      note: 'Impl Q9',
      draw: async () => new Map([['components/chip', 'no pictures in spec']]),
    });

    if (typeof step === 'string') throw new Error(step);

    return step.run();
  };

  it('regenerates the stale map and records the go', async () => {
    const lines = output();
    const { target, map, write } = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: { harness: HARNESS } });

    expect(existsSync(map)).toBe(false);
    expect(await goOf(target, write)).toBe(0);
    expect(readFileSync(map, 'utf8')).toContain("'components/chip'");
    expect(goMarkOf({ product, part: 'components/chip' })).not.toBeNull();
    expect(lines).toContain('regenerated the stale harness map');
    expect(harness(target, '--check')).toBe(0);
  });

  it('refuses with the regenerate command when the map cannot be written, and records no go', async () => {
    const lines = output();
    const { target, map, write } = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: { harness: HARNESS } });

    write('apps/app-a/src/harness/parts.ts/blocker', '');

    expect(existsSync(map)).toBe(true);
    expect(await goOf(target, write)).toBe(1);
    expect(lines.join('\n')).toContain('run et design harness --product app-a');
    expect(goMarkOf({ product, part: 'components/chip' })).toBeNull();
  });

  const studioGo = (target: string) => {
    const hash = goPartOf({
      product: resolveProduct({ target, name: 'app-a', config: { harness: HARNESS } }),
      part: 'components/chip',
    });

    return partGoAnswer({
      target,
      url: new URL('http://localhost/?product=app-a'),
      request: Object.assign(
        Readable.from([
          Buffer.from(JSON.stringify({ part: 'components/chip', hash: typeof hash === 'string' ? hash : hash.hash })),
        ]),
        { method: 'POST' },
      ) as unknown as IncomingMessage,
    });
  };

  it('records a Studio go and says why the map stayed stale when it cannot be written', async () => {
    const { target, write } = checkout();
    const product = resolveProduct({ target, name: 'app-a', config: { harness: HARNESS } });

    write('apps/app-a/src/harness/parts.ts/blocker', '');

    const answer = await studioGo(target);

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ harness: expect.stringContaining('run et design harness --product app-a') });
    expect(goMarkOf({ product, part: 'components/chip' })).not.toBeNull();
  });

  it('answers a Studio go without a harness field once the map is regenerated', async () => {
    const { target, map } = checkout();
    const answer = await studioGo(target);

    expect(answer.status).toBe(200);
    expect(answer.body).not.toHaveProperty('harness');
    expect(readFileSync(map, 'utf8')).toContain("'components/chip'");
  });
});
