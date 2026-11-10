import { execFileSync } from 'child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { warmOpenPointsWorker } from './open-points-worker.fixtures';
import { DESIGN_DIR } from '../design-config';
import { openPointsAnswer, partGoAnswer } from '../studio-api';
import { designGo } from './go-command';
import { TomPrompt } from './tom-confirm';
import { goPartOf, goPartsOf, goStateOf, readGo } from './part-go';
import { resolveProduct } from './resolve-product';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-go-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part(
    'components/chip',
    "export default definePart({ implements: 'libs/chip.component.ts', controls: { remove: {} }, states: { default: {} } });\n",
  );
  part('components/tag', 'export default definePart({ states: { default: {} } });\n');
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { target, dir: join(design, 'app-a') };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const hashOf = (target: string, part = 'components/chip') => {
  const found = goPartOf({ product: productOf(target), part });

  return typeof found === 'string' ? found : found.hash;
};

const request = (method: string, body?: unknown) =>
  Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]), {
    method,
  }) as unknown as IncomingMessage;

const post = (target: string, body: unknown) =>
  partGoAnswer({ target, url: new URL('http://localhost/?product=app-a'), request: request('POST', body) });

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

warmOpenPointsWorker();

describe('part go', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stores a go with an open point still listed, and drops it when the part changes', async () => {
    const { target, dir } = checkout();
    const hash = hashOf(target);

    expect((await post(target, { part: 'components/tag', hash: hashOf(target, 'components/tag') })).status).toBe(200);

    const answer = await post(target, { part: 'components/chip', by: 'tom', hash });

    expect(answer.status).toBe(200);
    expect(readGo(dir)['components/chip']).toEqual({
      hash,
      files: { '.ethlete/design/app-a/components/chip/chip.ts': expect.any(String) },
      by: 'user',
      via: 'studio click',
      at: expect.any(String),
      note: 'studio click',
    });
    expect(goPartsOf(productOf(target))).toEqual(['components/chip', 'components/tag']);

    appendFileSync(join(dir, 'components/chip/chip.ts'), '// changed\n');

    expect(goStateOf({ product: productOf(target), part: 'components/chip' })).toBe('stale');
    expect(goPartsOf(productOf(target))).toEqual(['components/tag']);
  });

  it('refuses a Studio go without the shown hash or a body part, for an unknown part and on a stale hash', async () => {
    const { target, dir } = checkout();

    expect(await post(target, { part: 'components/chip' })).toMatchObject({
      status: 400,
      body: { reason: 'hash-missing' },
    });
    expect(await post(target, { hash: 'x' })).toMatchObject({ status: 400, body: { reason: 'part-missing' } });
    expect(await post(target, { part: 'components/gone', hash: 'x' })).toMatchObject({
      status: 404,
      body: { reason: 'unknown-part' },
    });
    expect(await post(target, { part: 'components/chip', hash: 'stale' })).toMatchObject({
      status: 409,
      body: { reason: 'changed' },
    });
    expect(readGo(dir)).toEqual({});
  });

  it('answers the open points of a part with a go', async () => {
    const { target } = checkout();

    await post(target, { part: 'components/chip', hash: hashOf(target) });

    const answer = await openPointsAnswer({
      target,
      url: new URL('http://localhost/?product=app-a&part=components/chip'),
      request: request('GET'),
    });

    expect(answer.body).toMatchObject({ directEdit: false, points: [] });
    expect(answer.body).not.toHaveProperty('go');
  }, 30_000);

  it('et design go stores a go, and refuses an unknown part and a missing author', async () => {
    const { target, dir } = checkout();
    const lines = output();
    const go = (...argv: string[]) =>
      designGo({
        target,
        argv,
        invocation: 'et design',
        draw: async ({ parts }) => new Map(parts.map((part) => [part, { default: 'a1' }])),
        declaredActions: async () => [],
      });

    expect(await go('components/chip', '--product', 'app-a')).toBe(2);
    expect(await go('components/gone', '--product', 'app-a', '--by', 'tom')).toBe(1);
    expect(await go('components/chip', '--product', 'app-a', '--by', 'claude-opus-5-5')).toBe(1);
    expect(lines.at(-1)).toContain('only Tom grants a go; agents report ready instead');
    expect(readGo(dir)).toEqual({});
  });

  const tomCheckout = () => {
    const { target, dir } = checkout();
    const git = (...args: string[]) => execFileSync('git', args, { cwd: target, encoding: 'utf8' }).trim();

    git('init', '-q');
    git('config', 'user.email', 'a@b.c');
    git('config', 'user.name', 'a');
    mkdirSync(join(target, 'plans'));
    writeFileSync(join(target, 'plans/p.md'), '- Impl Q7 chip (Tom): go.\n');
    git('add', '.');
    git('commit', '-qm', 'design and decision');

    return { target, dir, git };
  };

  const goWith = (target: string, prompt: TomPrompt) => {
    const asked: string[] = [];
    const go = (...argv: string[]) =>
      designGo({
        target,
        argv,
        invocation: 'et design',
        draw: async ({ parts }) => new Map(parts.map((part) => [part, { default: 'a1' }])),
        declaredActions: async () => ['open', 'emit:remove'],
        prompt: { isTTY: prompt.isTTY, ask: (question) => (asked.push(question), prompt.ask(question)) },
      });

    return { go, asked };
  };

  const yes: TomPrompt = { isTTY: true, ask: async () => 'y' };

  it('et design go --by tom needs a committed Impl Q decision, and notes a design that changed after it', async () => {
    const { target, dir } = checkout();
    const lines = output();
    const { go } = goWith(target, yes);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: target, encoding: 'utf8' }).trim();
    const chip = join(dir, 'components/chip/chip.ts');
    const tom = ['components/chip', '--product', 'app-a', '--by', 'tom'];

    git('init', '-q');
    git('config', 'user.email', 'a@b.c');
    git('config', 'user.name', 'a');
    git('add', '.');
    git('commit', '-qm', 'design');

    expect(await go(...tom)).toBe(1);
    expect(lines.at(-1)).toContain('needs --note');
    expect(await go(...tom, '--note', 'Impl Q7')).toBe(1);
    expect(lines.at(-1)).toContain('no plans entry');

    mkdirSync(join(target, 'plans'));
    writeFileSync(join(target, 'plans/p.md'), '- Impl Q7 chip (Tom): go.\n');
    expect(await go(...tom, '--note', 'Impl Q7')).toBe(1);
    expect(lines.at(-1)).toContain('not committed');
    expect(readGo(dir)).toEqual({});

    git('add', 'plans');
    git('commit', '-qm', 'decision');
    const decision = git('rev-parse', '--short', 'HEAD');

    appendFileSync(chip, '// edit\n');
    git('commit', '-qam', 'newer design');

    expect(await go(...tom, '--note', 'Impl Q7')).toBe(0);
    expect(lines).toContain(`  go app-a components/chip - Impl Q7 - design changed after Impl Q7 (${decision})`);
    expect(readGo(dir)['components/chip']).toMatchObject({
      by: 'tom',
      note: 'Impl Q7',
      actions: ['emit:remove', 'open'],
    });
  });

  it('records the action keys a Studio go finds in the part it loads', async () => {
    const { target, dir } = checkout();
    const definition = {
      states: { default: {}, open: { open: true } },
      render: (props: { open?: true }) => ({
        body: `<button data-et-action="emit:remove"></button>${props.open ? "<div data-et-action='closed'></div>" : ''}`,
      }),
    };
    const answer = await partGoAnswer({
      target,
      url: new URL('http://localhost/?product=app-a'),
      request: request('POST', { part: 'components/chip', hash: hashOf(target) }),
      load: async () => ({ default: definition }),
      drawStates: async ({ parts }) => new Map(parts.map((part) => [part, { default: 'a1' }])),
    });

    expect(answer.status).toBe(200);
    expect(readGo(dir)['components/chip']?.actions).toEqual(['closed', 'emit:remove']);
    expect(readFileSync(join(dir, 'go.json'), 'utf8')).toContain('"actions": ["closed", "emit:remove"]');
  });

  it('et design go --by tom refuses without a TTY and records nothing unless Tom answers yes', async () => {
    const { target, dir } = tomCheckout();
    const lines = output();
    const tom = ['components/chip', '--product', 'app-a', '--by', 'tom', '--note', 'Impl Q7'];

    expect(await goWith(target, { isTTY: false, ask: async () => 'y' }).go(...tom)).toBe(1);
    expect(lines.at(-1)).toContain('et design go --batch <file>');

    const declined = goWith(target, { isTTY: true, ask: async () => 'n' });

    expect(await declined.go(...tom)).toBe(1);
    expect(declined.asked).toHaveLength(1);
    expect(readGo(dir)).toEqual({});

    const other = goWith(target, { isTTY: false, ask: async () => 'n' });

    expect(await other.go('components/chip', '--product', 'app-a', '--by', 'claude-opus-5-5')).toBe(1);
    expect(other.asked).toEqual([]);
    expect(readGo(dir)).toEqual({});
  });

  it('et design go --batch shows every entry once and records them all as Tom on yes', async () => {
    const { target, dir, git } = tomCheckout();
    const lines = output();
    const sha = git('rev-parse', 'HEAD');
    const list = join(target, 'go-list.json');
    const entry = (part: string) => ({ part, product: 'app-a', action: 'go', note: 'Impl Q7', verify: sha });

    writeFileSync(list, JSON.stringify([entry('components/chip'), entry('components/tag')]));

    expect(await goWith(target, { isTTY: false, ask: async () => 'y' }).go('--batch', list)).toBe(1);
    expect(readGo(dir)).toEqual({});
    expect(lines.join('\n')).toContain(`not through an agent shell: `);
    expect(lines.join('\n')).toContain(` go --batch ${list}`);

    const confirmed = goWith(target, yes);

    expect(await confirmed.go('--batch', list)).toBe(0);
    expect(confirmed.asked).toEqual(['Record these 2 as Tom? [y/N] ']);
    expect(lines.join('\n')).toContain(`  go app-a components/tag - Impl Q7 - verify ${sha}`);
    expect(readGo(dir)).toMatchObject({
      'components/chip': { by: 'tom', note: 'Impl Q7' },
      'components/tag': { by: 'tom', note: 'Impl Q7' },
    });
  });

  it('et design go --batch refuses the whole list when one entry fails, before it asks', async () => {
    const { target, dir } = tomCheckout();
    const lines = output();
    const list = join(target, 'go-list.json');

    writeFileSync(
      list,
      JSON.stringify([
        { part: 'components/chip', product: 'app-a', action: 'go', note: 'Impl Q7' },
        { part: 'components/tag', product: 'app-a', action: 'go', note: 'Impl Q9' },
        { part: 'components/tag', product: 'app-a', action: 'accept', note: 'Impl Q7', verify: 'nope' },
      ]),
    );

    const run = goWith(target, yes);

    expect(await run.go('--batch', list)).toBe(1);
    expect(run.asked).toEqual([]);
    expect(lines.join('\n')).toContain('no plans entry "Impl Q9"');
    expect(lines.join('\n')).toContain('verify nope is no commit');
    expect(readGo(dir)).toEqual({});

    writeFileSync(list, JSON.stringify([{ part: 'components/chip', action: 'go' }]));
    expect(await run.go('--batch', list)).toBe(1);
    expect(lines.at(-1)).toContain('entry 1');
  });
});
