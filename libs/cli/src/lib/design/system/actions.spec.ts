import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { actionFailureOf, ActionElement, pairElementsOf, parseAction, targetStateOf } from './actions';
import { checkActions, designActions, runActionInput } from './actions-command';

const element = (found: Partial<ActionElement>): ActionElement => ({
  key: 'button "Go"',
  occurrence: 0,
  probe: 0,
  action: null,
  control: null,
  ...found,
});

describe('actions', () => {
  it('parses a state or an emitted output, and names a state the part lacks', () => {
    expect(parseAction(null, ['rest'])).toBeNull();
    expect(parseAction('open', ['rest', 'open'])).toEqual({ kind: 'state', state: 'open' });
    expect(parseAction('emit:collapse', [])).toEqual({ kind: 'emit', output: 'collapse' });
    expect(parseAction('emit:', [])).toBe('data-et-action="emit:" names no output');
    expect(parseAction('shut', ['rest'])).toBe('data-et-action="shut" names no state of the part - its states: rest');
  });

  it('sends a key press to the focus-visible row of the declared state where the part draws one', () => {
    const states = ['rest', 'open', 'open-focus-visible', 'closed'];

    expect(targetStateOf({ state: 'open', input: 'click', states })).toBe('open');
    expect(targetStateOf({ state: 'open', input: 'Enter', states })).toBe('open-focus-visible');
    expect(targetStateOf({ state: 'closed', input: 'Space', states })).toBe('closed');
  });

  it('pairs design and app elements by key and occurrence, and lists declared design elements the app lacks', () => {
    const design = [
      element({ action: 'emit:a' }),
      element({ occurrence: 1, action: 'emit:b' }),
      element({ key: 'link "Help"', action: 'emit:help' }),
    ];
    const app = [element({ probe: 3 }), element({ key: 'tab "X"' })];

    expect(pairElementsOf({ design, app })).toEqual({
      paired: [
        { app: app[0], design: design[0] },
        { app: app[1], design: null },
      ],
      missing: [design[1], design[2]],
    });
  });

  it('fails a missed output or state, and names a prevented keydown only for a key', () => {
    const emit = { kind: 'emit' as const, output: 'collapse' };
    const outcome = { emitted: ['other'], prevented: true, compare: null };

    expect(
      actionFailureOf({ action: emit, target: '', input: 'click', outcome: { ...outcome, emitted: ['collapse'] } }),
    ).toBeNull();
    expect(actionFailureOf({ action: emit, target: '', input: 'click', outcome })).toBe(
      'fired no collapse output (fired other)',
    );
    expect(actionFailureOf({ action: emit, target: '', input: 'Space', outcome })).toBe(
      'fired no collapse output (fired other); its keydown default was prevented',
    );
    expect(
      actionFailureOf({
        action: { kind: 'state', state: 'open' },
        target: 'open-focus-visible',
        input: 'Enter',
        outcome: { emitted: [], prevented: false, compare: { ok: false, detail: 'DIFF 12 px' } },
      }),
    ).toBe('does not reach state open-focus-visible (DIFF 12 px)');
  });

  it('needs no go, prints a line per element and input and exits 1 on any failure', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-actions-'));
    const design = join(target, DESIGN_DIR);
    const lines: string[] = [];

    mkdirSync(join(design, 'app-a/components/chip'), { recursive: true });
    writeFileSync(
      join(design, 'app-a/components/chip/chip.ts'),
      "export default definePart({ implements: 'libs/chip/chip.component.ts', states: { default: {} } });\n",
    );
    writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
    vi.spyOn(console, 'log').mockImplementation((line) => void lines.push(String(line)));
    vi.spyOn(console, 'error').mockImplementation((line) => void lines.push(String(line)));

    const check = vi.fn<typeof checkActions>(async () => ({
      lines: [
        { state: 'default', element: 'button "Go"', input: 'click', failure: null },
        { state: 'default', element: 'button "Go"', input: 'Space', failure: 'fired no go output' },
      ],
      pictures: null,
    }));
    const run = () =>
      designActions({
        target,
        argv: ['components/chip', '--product', 'app-a', '--url', 'http://localhost:9'],
        invocation: 'et design',
        check,
      });

    expect(await run()).toBe(1);
    expect(lines).toEqual([
      'default button "Go" click ok',
      'default button "Go" Space FAILED fired no go output',
      'components/chip: 1 of 2 action check(s) failed',
    ]);

    check.mockResolvedValueOnce({ lines: [], pictures: null });
    expect(await run()).toBe(0);
  });
});

describe('runActionInput', () => {
  let browser: Browser | undefined;
  let server: Server;
  let url = '';

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
    server = createServer((_, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(`<body><div data-design-harness-host>
        <button aria-label="Go" onclick="__etDesignEmits.push({ output: 'go' })">Go</button>
        <button aria-label="Hide" onclick="__etDesignEmits.push({ output: 'hide' })">Hide</button>
        <button aria-label="Off" disabled>Off</button>
      </div>
      <script>
        window.__etDesignEmits = [];
        document.addEventListener('keydown', (event) => { if (event.key === ' ' && event.target.ariaLabel === 'Hide') event.preventDefault(); });
      </script></body>`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const press = (key: string, input: 'click' | 'Enter' | 'Space') =>
    runActionInput({
      browser: browser as Browser,
      url,
      start: { state: 'rest', props: {}, opener: null },
      pick: { key, occurrence: 0 },
      input,
      shoot: null,
      timeout: 10_000,
    });

  it('records the outputs a click, Enter and Space fire', async (context) => {
    if (!browser) return context.skip('no browser');

    for (const input of ['click', 'Enter', 'Space'] as const)
      expect(await press('button "Go"', input)).toEqual({ emitted: ['go'], prevented: false, app: null });
  });

  it('sees a Space whose keydown default the app prevents, so it fires nothing', async (context) => {
    if (!browser) return context.skip('no browser');

    expect(await press('button "Hide"', 'Space')).toEqual({ emitted: [], prevented: true, app: null });
    expect(await press('button "Hide"', 'Enter')).toEqual({ emitted: ['hide'], prevented: false, app: null });
  });

  it('never presses a disabled element', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(press('button "Off"', 'click')).rejects.toThrow('the element is gone');
  });
});
