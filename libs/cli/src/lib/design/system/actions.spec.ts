import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import {
  actionFailureOf,
  ActionElement,
  actionScanScriptOf,
  componentSelectorOf,
  drawsStateAlreadyOf,
  embeddedOwnersScriptOf,
  embeddersOf,
  openedFromOf,
  pairElementsOf,
  parseAction,
  resolveActionOf,
  targetStateOf,
} from './actions';
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

  it('names the parts that declare a control drawn by the part, never the part itself', () => {
    expect(
      embeddersOf({
        part: 'components/tree-row',
        controls: {
          'elements/part-tree': { row: { kind: 'row', part: 'components/tree-row' } },
          'components/tree-row': { row: { kind: 'row', part: 'components/tree-row' } },
          'elements/shell': { collapse: { kind: 'button', part: 'components/shell-collapse' } },
          'components/plain': undefined,
        },
      }),
    ).toEqual(['elements/part-tree']);
    expect(embeddersOf({ part: 'components/shell-collapse', controls: { 'elements/shell': 'broken' } })).toEqual([]);
  });

  it('resolves a state an embedded part already draws against the page that has it too', () => {
    const page = { part: 'elements/part-b', states: ['open', 'picker'] };
    const owners = [{ part: 'components/part-a', states: ['closed', 'open'] }];

    expect(resolveActionOf({ value: 'open', owners, page, settled: ['components/part-a'] }).owner).toBe(
      'elements/part-b',
    );
    expect(resolveActionOf({ value: 'closed', owners, page, settled: ['components/part-a'] }).owner).toBe(
      'components/part-a',
    );
  });

  it('tells a state whose expanded controls the start drawing already shows', () => {
    expect(drawsStateAlreadyOf({ expected: { 'button "A"': 'true' }, current: { 'button "A"': 'true' } })).toBe(true);
    expect(drawsStateAlreadyOf({ expected: { 'button "A"': 'true' }, current: { 'button "A"': 'false' } })).toBe(false);
    expect(drawsStateAlreadyOf({ expected: {}, current: {} })).toBe(false);
  });

  it('expects a surface opened from another state over that state, with the opening props only', () => {
    const states = {
      rest: { panel: 'open' },
      picker: { panel: 'open', picker: 'open' },
      stopped: { panel: 'open', server: 'stopped' },
      gone: { picker: 'open' },
    };
    const open = { control: 'project', from: 'rest' };

    expect(openedFromOf({ goal: 'picker', start: 'stopped', states, open })).toEqual({ picker: 'open' });
    expect(openedFromOf({ goal: 'picker', start: 'rest', states, open })).toBeNull();
    expect(openedFromOf({ goal: 'picker', start: 'picker', states, open })).toBeNull();
    expect(openedFromOf({ goal: 'picker', start: 'stopped', states, open: undefined })).toBeNull();
    expect(openedFromOf({ goal: 'gone', start: 'stopped', states, open })).toBeNull();
  });

  it('resolves a state declared inside an embedded part against the innermost part that has it, the page last', () => {
    const page = { part: 'pages/page-a', states: ['open', 'busy'] };
    const owners = [
      { part: 'components/part-a', states: ['rest', 'open'] },
      { part: 'elements/part-b', states: ['open', 'picker'] },
    ];

    expect(resolveActionOf({ value: 'open', owners, page })).toEqual({
      action: { kind: 'state', state: 'open' },
      owner: 'components/part-a',
    });
    expect(resolveActionOf({ value: 'picker', owners, page })).toEqual({
      action: { kind: 'state', state: 'picker' },
      owner: 'elements/part-b',
    });
    expect(resolveActionOf({ value: 'busy', owners, page }).owner).toBe('pages/page-a');
    expect(resolveActionOf({ value: 'emit:x', owners, page }).action).toEqual({ kind: 'emit', output: 'x' });
    expect(resolveActionOf({ value: 'gone', owners: [], page }).action).toBe(
      'data-et-action="gone" names no state of the part - its states: open, busy',
    );
  });

  it("reads the element selector of an app component's decorator", () => {
    expect(componentSelectorOf("@Component({\n  selector: 'app-part-a',\n  template: ''\n})\nexport class A {}")).toBe(
      'app-part-a',
    );
    expect(componentSelectorOf("@Component({ template: '' })\nexport class A {}")).toBeNull();
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
        <app-part-a><button aria-label="Pick" onclick="__etDesignEmits.push({ output: 'pageAction' }); listeners.forEach((listener) => listener())">Pick</button></app-part-a>
      </div>
      <script>
        const listeners = [];
        const partA = { picked: { subscribe: (listener) => listeners.push(listener) } };
        window.ng = {
          getComponent: (element) => (element.localName === 'app-part-a' ? partA : null),
          getDirectiveMetadata: () => ({ outputs: { x: 'picked' } }),
        };
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

  it('records the outputs of an embedded component the page re-emits under another name', async (context) => {
    if (!browser) return context.skip('no browser');

    expect((await press('button "Pick"', 'click')).emitted).toEqual(['pageAction']);
    expect(
      (
        await runActionInput({
          browser: browser as Browser,
          url,
          start: { state: 'rest', props: {}, opener: null },
          pick: { key: 'button "Pick"', occurrence: 0 },
          input: 'click',
          shoot: null,
          timeout: 10_000,
          listen: ['app-part-a'],
        })
      ).emitted,
    ).toEqual(['pageAction', 'x']);
  });

  it('names the embedded parts that draw a design element, innermost first, and skips markup passed in as a slot', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    try {
      await page.setContent(`<div data-et-part="pages/page-a">
        <button aria-label="Own">Own</button>
        <div data-et-part="elements/part-b">
          <div data-et-part="components/part-a"><button aria-label="Inner" data-et-action="emit:x">Inner</button></div>
          <div data-et-slot="elements/part-b"><button aria-label="Passed" data-et-slot="elements/part-b">Passed</button></div>
        </div>
      </div>`);

      const found = (await page.evaluate(actionScanScriptOf(['body']))) as ActionElement[];
      const owners = (await page.evaluate(embeddedOwnersScriptOf('pages/page-a'))) as Record<string, string[]>;

      expect(Object.fromEntries(found.map((element) => [element.key, owners[String(element.probe)]]))).toEqual({
        'button "Own"': [],
        'button "Inner"': ['components/part-a', 'elements/part-b'],
        'button "Passed"': [],
      });
    } finally {
      await page.close();
    }
  });

  it('never presses a disabled element', async (context) => {
    if (!browser) return context.skip('no browser');

    await expect(press('button "Off"', 'click')).rejects.toThrow('the element is gone');
  });
});
