import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { designDom, ReadDom } from './dom-command';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-dom-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a/components/chip'), { recursive: true });
  writeFileSync(
    join(design, 'app-a/components/chip/chip.ts'),
    'export default definePart({ states: { default: {}, hover: {} } });\n',
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

describe('design dom', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints the pretty-printed design html of the asked state', async () => {
    const target = checkout();
    const lines = output();
    const read = vi.fn<ReadDom>(async () => ({ state: 'hover', html: '<div><span>a</span><p>b</p></div>' }));
    const dom = (argv: string[]) =>
      designDom({ target, argv: ['components/chip', '--product', 'app-a', ...argv], invocation: 'et design', read });

    expect(await dom(['--state', 'hover'])).toBe(0);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ part: 'components/chip', state: 'hover', app: false }));
    expect(lines.join('\n')).toContain('<div>\n');
    expect(lines.length).toBe(1);
  });

  it('reads the app html with --app from the given url', async () => {
    const target = checkout();
    const lines = output();
    const read = vi.fn<ReadDom>(async () => ({ state: 'default', html: '<i>x</i>' }));

    expect(
      await designDom({
        target,
        argv: ['components/chip', '--product', 'app-a', '--app', '--url', 'http://localhost:9'],
        invocation: 'et design',
        read,
      }),
    ).toBe(0);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ app: true, url: 'http://localhost:9', state: null }));
    expect(lines.join('\n')).toContain('<i>x</i>');
  });

  it('refuses an unknown part, a missing target and a reader problem', async () => {
    const target = checkout();
    const lines = output();
    const read = vi.fn<ReadDom>(async () => 'no state "x"');

    expect(await designDom({ target, argv: ['--product', 'app-a'], invocation: 'et design', read })).toBe(2);
    expect(
      await designDom({ target, argv: ['components/nope', '--product', 'app-a'], invocation: 'et design', read }),
    ).toBe(1);
    expect(read).not.toHaveBeenCalled();
    expect(
      await designDom({
        target,
        argv: ['components/chip', '--product', 'app-a', '--state', 'x'],
        invocation: 'et design',
        read,
      }),
    ).toBe(1);
    expect(lines.at(-1)).toBe('no state "x"');
  });
});
