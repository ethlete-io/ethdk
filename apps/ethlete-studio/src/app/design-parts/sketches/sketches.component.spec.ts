import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { sketchFrameSetOf } from '@ethlete/cli/sketch-frames';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { SKETCHES_LABELS } from '../../i18n/sketches-labels';
import { COMMENT_LIST_LABELS } from '../../i18n/comments-labels';
import { SYSTEM_LABELS, SYSTEM_TREE_LABELS } from '../../i18n/system-labels';
import { SketchesComponent, foldedStatesOf } from './sketches.component';
import { matrixBlocksOf } from './matrix-blocks';
import { cropOf } from './sketch-crops';
import { SKETCH_EDIT_SAMPLE, SKETCH_PINS, SketchComment, SketchRow } from './sketches-sample';

const LABELS = SKETCHES_LABELS;

const ROWS: SketchRow[] = [
  {
    key: 'current',
    note: 'Wie heute',
    width: 400,
    shots: [
      { state: 'rest', changed: false, height: 100 },
      { state: 'open', changed: false, height: 200 },
    ],
  },
  {
    key: 'x',
    note: 'Eine sehr lange Notiz zur Variante x, die über mehrere Zeilen umbricht und nichts abschneidet.',
    model: { short: 'Sonnet 5.5', id: 'claude-sonnet-5-5', agent: 'claude', when: '01.11. 09:00' },
    width: 400,
    shots: [
      { state: 'rest', changed: false, height: 100 },
      { state: 'open', changed: true, height: 240 },
    ],
  },
];

const render = async (inputs: Record<string, unknown>) => {
  const fixture = TestBed.createComponent(SketchesComponent);

  Object.entries({ rows: ROWS, pins: [], ...inputs }).forEach(([name, value]) =>
    fixture.componentRef.setInput(name, value),
  );
  await fixture.whenStable();

  return fixture;
};

const textOf = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const LIST_WIDTH = 10000;

const fontsLoaded = (...fontfaces: FontFace[]) =>
  document.fonts.dispatchEvent(Object.assign(new Event('loadingdone'), { fontfaces }));

const mockWorldSize = (width: number, height: number) => {
  const isWorld = (element: HTMLElement) => element.parentElement?.hasAttribute('data-sk-rows') ?? false;

  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return isWorld(this) ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return isWorld(this) ? height : 0;
  });
};

const configure = () =>
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

describe('SketchesComponent', () => {
  // The cold JIT compile of the component tree takes seconds on a throttled CPU; outside this hook it lands in the 5 s budget of the first cases.
  beforeAll(async () => {
    configure();
    const rounds = [{ value: 'r1', label: 'Runde 1', note: 'Wo steht der Status?' }];

    for (const inputs of [{ statesOpen: true }, { rounds, round: 'r1' }]) {
      const fixture = await render({ camera: '100', ...inputs });

      fixture.nativeElement.querySelector('[data-sk-folded] button')?.click();
      await fixture.whenStable();
      fixture.destroy();
    }

    TestBed.resetTestingModule();
  }, 30_000);

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? LIST_WIDTH : 0;
    });
    configure();
  });

  it('shows the empty state and no part tree when the product has no open sketches', async () => {
    const root: HTMLElement = (await render({ empty: true })).nativeElement;
    const empty = root.querySelector<HTMLElement>('[data-sketches-empty]');

    expect(empty?.textContent).toContain(SKETCHES_LABELS.emptyTitle);
    expect(empty?.textContent).toContain(SKETCHES_LABELS.emptyText);
    expect(root.textContent).toContain(SKETCHES_LABELS.none);
    expect(root.querySelector('ethlete-part-tree')).toBeNull();
    expect(root.querySelector('[data-sketches-page]')?.classList.contains('hidden')).toBe(true);
  });

  it('shows no empty state while sketches are open', async () => {
    const root: HTMLElement = (await render({})).nativeElement;

    expect(root.querySelector('[data-sketches-empty]')).toBeNull();
    expect(root.textContent).not.toContain(SKETCHES_LABELS.emptyTitle);
  });

  it('draws every variant head as a row above its frames, never as an opaque column', async () => {
    const root: HTMLElement = (await render({ rows: ROWS, camera: '100' })).nativeElement;
    const section = root.querySelector('[data-sk-row="x"]');

    expect(section?.className).toContain('grid-cols-[minmax(0,1fr)]');
    expect(section?.querySelector('[data-sk-head-row]')).not.toBeNull();
    expect(
      root.querySelectorAll('.bg-et-surface-background[data-sk-gutter], [data-sk-head-row].bg-et-surface-background'),
    ).toHaveLength(0);
  });

  it.each([
    ['three changed variants', ['a', 'b', 'c'], true],
    ['a single changed variant', ['a'], false],
  ] as const)('lays %s side by side only when there is more than one', async (_, keys, side) => {
    const changed = keys.map((key) => ({ ...ROWS[1]!, key, width: 100 }));
    const root: HTMLElement = (await render({ rows: changed, camera: '100' })).nativeElement;
    const list = root.querySelector('[data-sk-changed]');

    expect(
      [...root.querySelectorAll('[data-sk-changed] > [data-sk-row]')].map((row) => row.getAttribute('data-sk-row')),
    ).toEqual(keys);
    expect(list?.hasAttribute('data-sk-side-by-side')).toBe(side);
    expect(list?.classList.contains('flex-col')).toBe(!side);
  });

  it('gives a side-by-side variant without a shown state the width of a cell (tomflix shell-app run 0236, B676)', async () => {
    const drawn = (key: string): SketchRow => ({
      key,
      note: '',
      width: 75,
      sized: true,
      shots: [{ state: 'default', changed: true, height: 69, width: 75 }],
    });
    const rows = [{ key: 'a', note: '', width: 75, sized: true, shots: [] }, drawn('b'), drawn('c')];
    const root: HTMLElement = (
      await render({ part: 'elements/shell-app', rows, errored: ['a'], fresh: true, camera: '100' })
    ).nativeElement;
    const stage = root.querySelector<HTMLElement>('[data-sk-row="a"] [data-sk-stage-row="a"]');

    expect(root.querySelector('[data-sk-changed]')?.hasAttribute('data-sk-side-by-side')).toBe(true);
    expect(stage?.style.gridTemplateColumns).toBe('repeat(1, minmax(75px, max-content))');
    expect(stage?.querySelector('[data-sk-missing][data-sk-state="default"]')).not.toBeNull();
  });

  describe('a side-by-side variant whose module failed to load (tomflix shell-app, B676)', () => {
    const error =
      "Cannot find module '@system/foundations/logo' imported from '/home/tom/dev/scratch-b750/tomflix/.ethlete/design/tomflix/sketches/elements-shell-app/shared/shell-kit.ts'";
    const drawn = (key: string): SketchRow => ({
      key,
      note: '',
      width: 75,
      sized: true,
      shots: [{ state: 'default', changed: true, height: 69, width: 75 }],
    });
    const renderFailed = async () =>
      (
        await render({
          part: 'elements/shell-app',
          rows: [{ key: 'a', note: '', width: 75, sized: true, shots: [] }, drawn('b'), drawn('c')],
          errored: ['a'],
          failures: { a: error },
          fresh: true,
          camera: '100',
        })
      ).nativeElement as HTMLElement;

    it('marks its cells as failed, not as a state the variant dropped', async () => {
      const root = await renderFailed();
      const missing = root.querySelector<HTMLElement>('[data-sk-row="a"] [data-sk-missing][data-sk-state="default"]');

      expect(missing?.querySelector('[data-sk-failed-cell]')?.textContent?.trim()).toBe(LABELS.status.failed);
      expect(missing?.textContent).not.toContain(LABELS.removedIn(LABELS.variant('a')));
    });

    it('keeps its cells on the line of the other columns: the error clamps and the heads share one grid row', async () => {
      const root = await renderFailed();
      const list = root.querySelector<HTMLElement>('[data-sk-changed]');
      const failed = root.querySelector<HTMLElement>('[data-sk-row="a"] [data-sk-row-failed]');

      expect(failed?.classList.contains('line-clamp-3')).toBe(true);
      expect(failed?.title).toBe(LABELS.rowFailed(error));
      expect(list?.classList.contains('grid')).toBe(true);
      expect(list?.classList.contains('grid-rows-[auto_auto]')).toBe(true);
      for (const key of ['a', 'b', 'c']) {
        const section = root.querySelector(`[data-sk-changed] > [data-sk-row="${key}"]`);

        expect(section?.classList.contains('grid-rows-subgrid')).toBe(true);
        expect(section?.classList.contains('row-span-2')).toBe(true);
      }
    });
  });

  // Decision human 23.11. (B703): the title (e.g. "Entwurf 46 B") goes away, neither the part key nor a round title shows.
  it('shows no sketch title, neither the part key nor a round title', async () => {
    const root: HTMLElement = (await render({ camera: '100', rows: ROWS, part: 'elements/variant-cell@x' }))
      .nativeElement;
    const page = root.querySelector('[data-sketches-page]');

    expect(page?.querySelector('header')).toBeNull();
    expect(page?.querySelector('.text-ui-lg.font-ui-strong')).toBeNull();
    expect(textOf(page?.querySelector('[data-sk-toolbar]') ?? null)).not.toContain('elements/variant-cell@x');
  });

  it('names the sample pin after the design sample author', async () => {
    const rows = ROWS.map((row) => (row.key === 'x' ? { ...row, key: 'a' } : row));
    const root: HTMLElement = (await render({ camera: '100', rows, pins: SKETCH_PINS })).nativeElement;

    expect(root.querySelector('ethlete-comment-pin [aria-label]')?.getAttribute('aria-label')).toBe('Comment by human');
  });

  it('draws one row per variant with every state, dims the unchanged ones and marks the first change', async () => {
    const root: HTMLElement = (await render({ camera: '100', statesOpen: true })).nativeElement;
    const variant = root.querySelector('[data-sk-row="x"]');
    const states = [...(variant?.querySelectorAll('[data-sk-state]') ?? [])];

    expect([...root.querySelectorAll('[data-sk-row]')].map((row) => row.getAttribute('data-sk-row'))).toEqual([
      'current',
      'x',
    ]);
    expect(textOf(states[0])).toBe(`rest${LABELS.stateSeparator}${LABELS.unchanged}`);
    expect(states[0]?.querySelector('[data-sk-label]')?.classList.contains('opacity-50')).toBe(true);
    expect(states[1]?.querySelector('[data-sk-label]')?.classList.contains('opacity-50')).toBe(false);
    expect(root.querySelector('[data-sk-row="current"] .opacity-50')).toBeNull();
  });

  it('shows the whole interaction row of a changed state and folds the other rows', async () => {
    const states = ['save', 'save-hover', 'save-active', 'remove', 'remove-hover'];
    const rowOf = (key: string, changed: string[]): SketchRow => ({
      key,
      note: key,
      width: 300,
      shots: states.map((state) => ({ state, changed: changed.includes(state), height: 40 })),
    });
    const rows = [rowOf('current', []), rowOf('x', ['save-hover'])];
    const root: HTMLElement = (await render({ camera: '100', rows })).nativeElement;
    const variant = root.querySelector('[data-sk-row="x"]');
    const names = [...(variant?.querySelectorAll('[data-sk-state]') ?? [])].map((cell) =>
      cell.getAttribute('data-sk-state'),
    );

    expect(names).toEqual(['save', 'save-hover', 'save-active']);
  });

  it('lays the title card states out as one interaction grid, aligned across variants, each name once', async () => {
    const bases = ['default', 'series', 'fallback'];
    const variant = (key: string, folds: boolean): SketchRow => ({
      key,
      note: key,
      width: 264,
      shots: bases.flatMap((base) => [
        {
          state: base,
          changed: true,
          height: 392,
          ...(folds ? { restOf: [`${base}-focus-visible`] } : {}),
        },
        { state: `${base}-hover`, changed: true, height: 392 },
        ...(folds ? [] : [{ state: `${base}-focus-visible`, changed: true, height: 392 }]),
      ]),
    });
    const root: HTMLElement = (
      await render({ rows: [variant('a', false), variant('b', true), variant('c', true)], camera: '100' })
    ).nativeElement;
    const placeOf = (key: string, state: string) => {
      const cell = root.querySelector<HTMLElement>(
        `[data-sk-row="${key}"] [data-sk-state="${state}"], [data-sk-row="${key}"] [data-sk-folded-cell="${state}"]`,
      );

      return [cell?.style.gridRow, cell?.style.gridColumn];
    };
    const states = bases.flatMap((base) => [base, `${base}-hover`, `${base}-focus-visible`]);

    expect([...root.querySelectorAll('[data-sk-line-head]')].map(textOf)).toEqual(bases);
    expect([...root.querySelectorAll('[data-sk-row="a"] [data-sk-column-head]')].map(textOf)).toEqual([
      'rest',
      'hover',
      'focus-visible',
    ]);
    for (const key of ['b', 'c']) {
      expect(states.map((state) => placeOf(key, state))).toEqual(states.map((state) => placeOf('a', state)));
      expect(
        [...root.querySelectorAll(`[data-sk-row="${key}"] [data-sk-folded-cell]`)].map((cell) => [
          cell.getAttribute('data-sk-folded-cell'),
          textOf(cell),
        ]),
      ).toEqual(bases.map((base) => [`${base}-focus-visible`, LABELS.foldedToRest]));
    }
    expect(new Set(states.map((state) => placeOf('a', state).join())).size).toBe(states.length);
    expect(
      [...root.querySelectorAll('[data-sk-label-text]')].map((label) =>
        textOf(label.querySelector(':scope > span:not(.hidden)')),
      ),
    ).not.toContain('rest');
  });

  it('marks a focus-visible state every variant folds into rest as = rest, not as an empty cell', async () => {
    const bases = ['default', 'series', 'fallback'];
    const sameAsRest: Record<string, Record<string, string>> = {
      a: { 'default-focus-visible': 'default', 'series-focus-visible': 'series' },
      b: { 'default-focus-visible': 'default', 'series-focus-visible': 'series', 'fallback-focus-visible': 'fallback' },
      c: { 'default-focus-visible': 'default', 'series-focus-visible': 'series', 'fallback-focus-visible': 'fallback' },
    };
    const variant = (key: string): SketchRow => ({
      key,
      note: key,
      width: 264,
      shots: bases
        .flatMap((base) => [base, `${base}-hover`, `${base}-focus-visible`])
        .map((state) => {
          const restOf = Object.entries(sameAsRest[key]!)
            .filter(([, rest]) => rest === state)
            .map(([folded]) => folded);

          return {
            state,
            changed: true,
            height: 392,
            ...(sameAsRest[key]![state] ? { sameAsRest: true } : {}),
            ...(restOf.length > 0 ? { restOf } : {}),
          };
        }),
    });
    const root: HTMLElement = (await render({ rows: ['a', 'b', 'c'].map(variant), camera: '100' })).nativeElement;

    for (const key of ['a', 'b', 'c']) {
      expect(
        [...root.querySelectorAll(`[data-sk-row="${key}"] [data-sk-folded-cell]`)].map((cell) => [
          cell.getAttribute('data-sk-folded-cell'),
          textOf(cell),
        ]),
      ).toEqual(Object.keys(sameAsRest[key]!).map((state) => [state, LABELS.foldedToRest]));
    }
    expect(root.querySelector('[data-sk-row="a"] [data-sk-state="fallback-focus-visible"]')).not.toBeNull();
  });

  it('folds every state no variant is known to change while a compare is pending, and shows all from the toggle', async () => {
    const rows: SketchRow[] = [
      ...ROWS.slice(0, 1).map((row) => ({
        ...row,
        shots: [...row.shots, { state: 'busy', changed: false, height: 90 }],
      })),
      {
        ...ROWS[1]!,
        shots: [
          { state: 'rest', changed: false, height: 100 },
          { state: 'open', changed: true, height: 240 },
          { state: 'busy', changed: null, height: 90 },
        ],
      },
      {
        key: 'y',
        note: 'Ruhiger',
        width: 400,
        shots: [
          { state: 'rest', changed: false, height: 100 },
          { state: 'open', changed: false, height: 200 },
          { state: 'busy', changed: false, height: 90 },
        ],
      },
    ];
    const fixture = await render({
      rows,
      camera: '100',
      rounds: [{ value: 'r1', label: 'Runde 1', note: 'Wo steht der Status?' }],
      round: 'r1',
    });
    const root: HTMLElement = fixture.nativeElement;
    const framesOf = () =>
      [...root.querySelectorAll('[data-sk-row="x"] [data-sk-frame]')].map((frame) =>
        frame.getAttribute('data-sk-frame'),
      );

    expect(framesOf()).toEqual(['x open']);
    expect(root.querySelector('[data-sk-row="current"] [data-sk-frame="current rest"]')).toBeNull();
    expect(root.querySelector('[data-sk-folded]')?.hasAttribute('data-sk-pending')).toBe(true);
    expect(textOf(root.querySelector('[data-sk-folded] > span > span'))).toBe(LABELS.pendingStates(2));
    expect(textOf(root.querySelector('[data-sk-folded] button'))).toBe(LABELS.showAllStates);

    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await fixture.whenStable();

    expect(framesOf()).toEqual(['x rest', 'x open', 'x busy']);
  });

  it('selects a frame by key without activating it, so the wheel keeps panning, and reports a key it does not draw', async () => {
    const fixture = await render({ camera: '100', statesOpen: true });
    const root: HTMLElement = fixture.nativeElement;
    const activated = vi.fn();

    fixture.componentInstance.frameActivate.subscribe(activated);

    expect(fixture.componentInstance.focusFrame('x open')).toBe(true);
    await fixture.whenStable();
    expect(root.querySelector('[data-sk-frame="x open"]')?.hasAttribute('data-selected')).toBe(true);
    expect(activated).not.toHaveBeenCalled();
    expect(fixture.componentInstance.focusFrame('x nowhere')).toBe(false);
  });

  it('sizes the fold toggle to its label instead of its row', async () => {
    const rows: SketchRow[] = [
      { ...ROWS[0]!, shots: [...ROWS[0]!.shots, { state: 'busy', changed: false, height: 90 }] },
      { ...ROWS[1]!, shots: [...ROWS[1]!.shots, { state: 'busy', changed: false, height: 90 }] },
    ];
    const root: HTMLElement = (await render({ rows, camera: '100' })).nativeElement;
    const toggle = root.querySelector('[data-sk-folded] button');

    expect(toggle?.classList.contains('w-fit')).toBe(true);
    expect(toggle?.classList.contains('w-full')).toBe(false);
  });

  it('draws the same state set in Aktuell and every variant row', async () => {
    const rows: SketchRow[] = [
      { ...ROWS[0]!, shots: [...ROWS[0]!.shots, { state: 'busy', changed: false, height: 90 }] },
      { ...ROWS[1]!, shots: [...ROWS[1]!.shots, { state: 'busy', changed: false, height: 90 }] },
    ];
    const statesOf = (root: HTMLElement, key: string) =>
      [...root.querySelectorAll(`[data-sk-row="${key}"] [data-sk-state]`)].map((cell) =>
        cell.getAttribute('data-sk-state'),
      );
    const changed: HTMLElement = (await render({ rows, camera: '100' })).nativeElement;

    expect(statesOf(changed, 'current')).toEqual(['open']);
    expect(statesOf(changed, 'x')).toEqual(statesOf(changed, 'current'));

    const unchanged = rows.map((row) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: false })) }));
    const same: HTMLElement = (await render({ rows: unchanged, camera: '100' })).nativeElement;

    expect(statesOf(same, 'current')).toEqual(['rest', 'open', 'busy']);
  });

  it('draws a state only the variants declare in every variant row, with a placeholder in Aktuell', async () => {
    const unchanged = ROWS[0]!.shots;
    const variant = (key: string): SketchRow => ({
      ...ROWS[1]!,
      key,
      shots: [...unchanged, { state: 'failed', changed: true, height: 90 }],
    });
    const root: HTMLElement = (await render({ rows: [ROWS[0], variant('a'), variant('b')], camera: '100' }))
      .nativeElement;
    const statesOf = (key: string) =>
      [...root.querySelectorAll(`[data-sk-row="${key}"] [data-sk-state]`)].map((cell) => [
        cell.getAttribute('data-sk-state'),
        cell.hasAttribute('data-sk-missing'),
      ]);

    expect(statesOf('current')).toEqual([['failed', true]]);
    expect(statesOf('a')).toEqual([['failed', false]]);
    expect(statesOf('b')).toEqual([['failed', false]]);
  });

  it('folds no state, draws every state of Aktuell and offers no Übernehmen when every state draws like Aktuell', async () => {
    const rows = ROWS.map((row) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: false })) }));
    const fixture = await render({
      rows,
      camera: '100',
      status: 'waiting',
      rounds: [{ value: 'r1', label: 'Runde 1', note: 'Wo steht der Status?' }],
      round: 'r1',
    });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('[data-sk-folded]')).toBeNull();
    expect(root.querySelectorAll('[data-sk-row="current"] [data-sk-state]').length).toBe(2);
    expect(root.querySelector('[data-sk-merge]')).toBeNull();
  });

  it('offers no Übernehmen for an unchanged variant, folded or open', async () => {
    const same: SketchRow = { ...ROWS[1]!, key: 'y', shots: ROWS[0]!.shots };
    const fixture = await render({ camera: '100', status: 'waiting', rows: [...ROWS, same] });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelectorAll('[data-sk-merge]').length).toBe(1);

    fixture.componentInstance.sameOpen.set(true);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-row="y"]')).not.toBeNull();
    expect(root.querySelector('[data-sk-row="y"] [data-sk-merge]')).toBeNull();
    expect(root.querySelectorAll('[data-sk-merge]').length).toBe(1);
  });

  // The human wants the model icon and name in the variant label; keep it.
  it('shows the model icon and name beside the variant label, without a tooltip', async () => {
    const root: HTMLElement = (await render({})).nativeElement;
    const model = root.querySelector('[data-sk-row="x"] [data-sk-model]');

    expect(model?.querySelector('svg[ethlete-agent-logo]')).not.toBeNull();
    expect(textOf(model)).toBe('Sonnet 5.5');
    // B695: the model id and time are agent metadata, so the model name has no tooltip.
    expect(model?.hasAttribute('aria-describedby')).toBe(false);
    expect('modelTitle' in SKETCHES_LABELS).toBe(false);
  });

  it('hides withdrawn variants behind Zurückgezogene (n) and marks them in place of Übernehmen when shown', async () => {
    const withdrawn: SketchRow[] = [
      ...ROWS,
      { ...ROWS[1]!, key: 'y', withdrawn: 'Zu breit für die Leiste' },
      { ...ROWS[1]!, key: 'z', withdrawn: '' },
    ];
    // jsdom ignores rules inside `@layer`, so et-choice-field reads `display: inline` and the SDK logs an error.
    const layerShim = Object.assign(document.createElement('style'), { textContent: 'et-choice-field{display:flex}' });

    document.head.append(layerShim);
    onTestFinished(() => layerShim.remove());

    const fixture = await render({ rows: withdrawn });
    const root = fixture.nativeElement as HTMLElement;
    const shownKeys = () => [...root.querySelectorAll('[data-sk-row]')].map((row) => row.getAttribute('data-sk-row'));
    const changes: string[] = [];

    fixture.componentInstance.withdrawn.subscribe((value) => changes.push(value));

    expect(shownKeys()).toEqual(['current', 'x']);
    expect(textOf(root.querySelector('[data-sk-withdrawn-toggle]'))).toBe('Zurückgezogene (2)');

    root.querySelector<HTMLElement>('[data-sk-withdrawn-toggle] et-switch')?.click();
    await fixture.whenStable();

    expect(changes).toEqual(['shown']);
    expect(shownKeys()).toEqual(['current', 'x', 'y', 'z']);
    expect(textOf(root.querySelector('[data-sk-row="y"] [data-sk-withdrawn]'))).toBe(
      SYSTEM_TREE_LABELS.withdrawnWith('Zu breit für die Leiste'),
    );
    expect(textOf(root.querySelector('[data-sk-row="z"] [data-sk-withdrawn]'))).toBe(SYSTEM_TREE_LABELS.withdrawnLabel);
    expect(root.querySelector('[data-sk-row="y"] [data-sk-merge]')).toBeNull();
    expect(root.querySelector('[data-sk-row="x"] [data-sk-merge]')).not.toBeNull();
    expect(root.querySelector('[data-sk-row="x"] [data-sk-withdrawn]')).toBeNull();
  });

  it('keeps a state a hidden withdrawn variant changes unfolded', async () => {
    const withdrawn: SketchRow = {
      ...ROWS[1]!,
      key: 'w',
      withdrawn: '',
      shots: [
        { state: 'rest', changed: true, height: 100 },
        { state: 'open', changed: false, height: 200 },
      ],
    };
    const layerShim = Object.assign(document.createElement('style'), { textContent: 'et-choice-field{display:flex}' });

    document.head.append(layerShim);
    onTestFinished(() => layerShim.remove());

    const root: HTMLElement = (await render({ camera: '100', rows: [...ROWS, withdrawn] })).nativeElement;

    expect(root.querySelector('[data-sk-row="w"]')).toBeNull();
    expect(root.querySelectorAll('[data-sk-row="x"] [data-sk-state]')).toHaveLength(2);
  });

  it('shows no Zurückgezogene toggle while no variant is withdrawn', async () => {
    const root = (await render({})).nativeElement as HTMLElement;

    expect(root.querySelector('[data-sk-withdrawn-toggle]')).toBeNull();
  });

  // Picking a variant opens a confirm dialog and merges only on confirm.
  it('asks to confirm Übernehmen and emits merge with the variant only once confirmed', async () => {
    const fixture = await render({ part: 'components/very-long-part-name' });
    const merged: string[] = [];
    const take = async () => {
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
        .find((button) => textOf(button) === LABELS.merge)
        ?.click();
      await fixture.whenStable();

      return [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].at(-1);
    };
    const press = async (selector: string) => {
      [...document.querySelectorAll<HTMLElement>(selector)].at(-1)?.click();
      await fixture.whenStable();
    };

    fixture.componentInstance.merge.subscribe((variant) => merged.push(variant));

    const dialog = await take();

    expect(textOf(dialog)).toContain(
      LABELS.mergeConfirm.question(LABELS.variant('x'), 'components/very-long-part-name'),
    );
    expect(textOf(dialog)).toContain(LABELS.mergeConfirm.note);
    expect(merged).toEqual([]);

    await press('[data-sk-confirm-cancel]');
    expect(merged).toEqual([]);

    await take();
    await press('[data-sk-confirm]');
    expect(merged).toEqual(['x']);
  });

  it('lists the sub-sketches a pick of another variant discards and keeps before it emits merge', async () => {
    const fixture = await render({
      part: 'components/zoom-chip',
      repicks: { x: { discards: ['components/zoom-hint'], keeps: ['components/zoom-dots'] } },
    });
    const merged: string[] = [];

    fixture.componentInstance.merge.subscribe((variant) => merged.push(variant));
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
      .find((button) => textOf(button) === LABELS.merge)
      ?.click();
    await fixture.whenStable();

    const dialog = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].at(-1);
    const lists = [...(dialog?.querySelectorAll('[data-sk-confirm-list]') ?? [])].map((list) =>
      [...list.querySelectorAll('span')].map(textOf),
    );

    expect(textOf(dialog)).toContain(LABELS.repickConfirm.note);
    expect(lists).toEqual([
      [LABELS.repickConfirm.discards, 'components/zoom-hint'],
      [LABELS.repickConfirm.keeps, 'components/zoom-dots'],
    ]);

    [...document.querySelectorAll<HTMLElement>('[data-sk-confirm]')].at(-1)?.click();
    await fixture.whenStable();
    expect(merged).toEqual(['x']);
  });

  it('opens the confirm a bound confirm names and clears it once the dialog closes', async () => {
    const fixture = await render({ part: 'components/card', confirm: 'discard' });
    const dialog = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].at(-1);

    expect(textOf(dialog)).toContain(LABELS.discardConfirm.question('components/card'));

    [...document.querySelectorAll<HTMLElement>('[data-sk-confirm-cancel]')].at(-1)?.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await fixture.whenStable();

    expect(fixture.componentInstance.confirm()).toBeNull();
  });

  it('opens a bound merge confirm on the selected variant', async () => {
    await render({ part: 'components/card', selected: 'x', confirm: 'merge' });
    const dialog = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].at(-1);

    expect(textOf(dialog)).toContain(LABELS.mergeConfirm.question(LABELS.variant('x'), 'components/card'));
  });

  it('keeps a bound merge confirm until its Übernehmen renders, then opens it', async () => {
    const fixture = await render({ part: 'components/card', selected: 'x', confirm: 'merge', status: 'drawing' });

    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(0);
    expect(fixture.componentInstance.confirm()).toBe('merge');

    fixture.componentRef.setInput('status', 'waiting');
    await fixture.whenStable();
    const dialog = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].at(-1);

    expect(textOf(dialog)).toContain(LABELS.mergeConfirm.question(LABELS.variant('x'), 'components/card'));
  });

  it('lists the comments of the variants under the tree and pins each on its state', async () => {
    const comments: SketchComment[] = ['one', 'two', 'three'].map((text, index) => ({
      id: `k${index}`,
      variant: 'x',
      shot: index === 2 ? 'gone' : (ROWS[1]?.shots[0]?.state ?? ''),
      point: { x: 4, y: 4 },
      author: 'Mira Langname-Beispiel',
      initials: 'ML',
      when: 'jetzt',
      part: 'Variante x',
      state: 'rest',
      text,
      replies: 0,
    }));
    const fixture = await render({ comments, selectedComment: 'k1' });
    const root: HTMLElement = fixture.nativeElement;
    const picked: string[] = [];

    fixture.componentInstance.commentPick.subscribe((id) => picked.push(id));

    expect(textOf(root.querySelector('[data-comment-list]'))).toContain(COMMENT_LIST_LABELS.open(3));
    expect(root.querySelectorAll('[data-comment-list] ethlete-comment-row')).toHaveLength(3);
    expect(root.querySelectorAll('[data-sk-row="x"] ethlete-comment-pin')).toHaveLength(3);

    root.querySelector<HTMLElement>('[data-comment-list] ethlete-comment-row [role="button"]')?.click();
    expect(picked).toEqual(['k0']);
  });

  it('turns comment mode on with Kommentar and starts a draft on a variant, not on Aktuell', async () => {
    const fixture = await render({ comments: [] });
    const root: HTMLElement = fixture.nativeElement;
    const started: unknown[] = [];

    fixture.componentInstance.commentStart.subscribe((place) => started.push(place));
    root.querySelector<HTMLElement>(`[data-sk-toolbar] button[aria-label="${SYSTEM_LABELS.comment}"]`)?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.commentMode()).toBe(true);
    expect(root.querySelector('[data-sk-row="current"] .cursor-crosshair')).toBeNull();

    root
      .querySelector<HTMLElement>('[data-sk-row="x"] .cursor-crosshair')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const shown = root.querySelector('[data-sk-row="x"] [data-sk-frame]')?.getAttribute('data-sk-frame');

    expect(started).toEqual([{ variant: 'x', shot: shown?.replace('x ', ''), point: null }]);
  });

  it('drops the current row for a new part', async () => {
    const root: HTMLElement = (await render({ fresh: true })).nativeElement;

    expect(root.querySelector('[data-sk-row="current"]')).toBeNull();
  });

  it('drops the current row when no variant draws one of its states (tomflix button over the SDK button, B676)', async () => {
    const sizes = { abspielen: 204, 'mehr-infos': 212, filter: 108 };
    const base = ['filled', 'filled-hover', 'outline', 'outline-hover'];
    const drawn = Object.entries(sizes).flatMap(([name, width]) =>
      ['', '-hover', '-focus-visible', '-active', '-disabled'].map((suffix) => ({
        state: `${name}${suffix}`,
        changed: true,
        height: 108,
        width,
      })),
    );
    const inherited = base.map((state) => ({ state, changed: false, height: 108, inherited: true as const }));
    const rows: SketchRow[] = [
      {
        key: 'current',
        note: '',
        width: 212,
        shots: base.map((state) => ({
          state,
          changed: false,
          height: 108,
        })),
      },
      ...['a', 'b', 'c'].map((key) => ({ key, note: '', width: 212, shots: [...drawn, ...inherited] })),
    ];
    const root: HTMLElement = (await render({ camera: '100', rows })).nativeElement;

    expect(root.querySelectorAll('[data-sk-frame^="a "]')).toHaveLength(15);
    expect(root.querySelector('[data-sk-variant="current"], [data-sk-row="current"]')).toBeNull();
  });

  // A sketch forecast to merge itself shows a mark in the Studio header.
  it('shows the auto-merge mark in the header only when the forecast says the sketch merges itself', async () => {
    const mark = (root: HTMLElement) => root.querySelector('[data-sk-toolbar] [data-sk-auto-merge] [data-sk-status]');

    expect(
      mark((await render({ autoMerge: true, status: 'drawing' })).nativeElement)?.getAttribute('data-sk-status'),
    ).toBe('autoMerge');
    expect(mark((await render({ status: 'drawing' })).nativeElement)).toBeNull();
  });

  it('offers Verwerfen on a sketch, but not on the old/new sketch of a direct edit', async () => {
    const buttons = (root: HTMLElement) =>
      [...root.querySelectorAll('[data-sk-toolbar] button')].map((button) => button.getAttribute('aria-label'));

    expect(buttons((await render({ part: 'components/card' })).nativeElement)).toContain(LABELS.discard);
    const edit: HTMLElement = (await render({ part: 'components/card@edit' })).nativeElement;

    expect(buttons(edit)).not.toContain(LABELS.discard);
    expect(edit.querySelector('[data-sk-toolbar]')?.textContent).not.toContain('Kein Verwerfen');
  });

  it('discards only after the confirm, and Abbrechen keeps the sketch', async () => {
    const fixture = await render({ part: 'components/card' });
    const discarded = vi.fn();
    const discardButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[data-sk-toolbar] button[aria-label="${LABELS.discard}"]`,
    );
    const open = async () => {
      discardButton?.click();
      await fixture.whenStable();

      return [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].at(-1);
    };
    const press = async (selector: string) => {
      [...document.querySelectorAll<HTMLElement>(selector)].at(-1)?.click();
      await fixture.whenStable();
    };

    fixture.componentInstance.discard.subscribe(discarded);

    const dialog = await open();

    expect(textOf(dialog)).toContain(LABELS.discardConfirm.question('components/card'));
    expect(textOf(dialog)).toContain(LABELS.discardConfirm.note);
    expect(discarded).not.toHaveBeenCalled();

    await press('[data-sk-confirm-cancel]');
    expect(discarded).not.toHaveBeenCalled();

    await open();
    await press('[data-sk-confirm]');
    expect(discarded).toHaveBeenCalledTimes(1);
  });

  it('offers no merge while the sketch is not ready', async () => {
    const root: HTMLElement = (await render({ camera: '100', status: 'not-ready' })).nativeElement;

    expect(root.querySelector('[data-sk-merge]')).toBeNull();
  });

  // B695: the agent's report text is not something the human acts on, so the drawing row shows only the mark.
  it('draws the in-progress variant live with the in-progress mark and no report text, never as finished', async () => {
    const rows = ROWS.map((row) => (row.key === 'x' ? { ...row, drawing: true as const } : row));
    const root: HTMLElement = (await render({ rows, status: 'drawing', drawn: 'x', camera: '100' })).nativeElement;
    const row = root.querySelector('[data-sk-row="x"]');

    expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')?.getAttribute('data-sk-status')).toBe('drawing');
    expect(row?.querySelector('[data-sk-placeholder-row]')).toBeNull();
    expect(row?.querySelector('[data-sk-stage]')).not.toBeNull();
    expect(textOf(row)).toContain(LABELS.drawingMark);
    expect(row?.querySelector('[data-sk-drawing-line]')).toBeNull();
    expect(row?.querySelector('[data-sk-merge]')).toBeNull();
  });

  it('toggles the hold reason of a paused sketch', async () => {
    const fixture = await render({ status: 'paused' });
    const root: HTMLElement = fixture.nativeElement;
    const reason = () => document.querySelector<HTMLElement>('[data-sk-status-tip]');

    expect(reason()).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-sk-status-button]')?.click();
    await fixture.whenStable();

    expect(textOf(reason())).toContain(LABELS.holdUntil('B34/B36/B38'));

    root.querySelector<HTMLButtonElement>('[data-sk-status-button]')?.click();
    await fixture.whenStable();
  });

  it('sizes each frame from the part size at a fixed zoom', async () => {
    const root: HTMLElement = (await render({ camera: { zoom: 0.5, x: 0, y: 0 } })).nativeElement;
    const frame = root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-state="open"] [data-sk-frame]');

    expect(frame?.style.width).toBe('200px');
    expect(frame?.style.height).toBe('120px');
  });

  it('sizes each frame to the part width times the zoom and wraps narrow parts into columns', async () => {
    const root: HTMLElement = (await render({ camera: '100', statesOpen: true })).nativeElement;
    const frame = root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-frame="x open"]');
    const stage = root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-stage]');

    expect(frame?.style.width).toBe('400px');
    expect(frame?.style.height).toBe('240px');
    expect(stage?.style.gridTemplateColumns).toBe('repeat(2, minmax(400px, max-content))');
  });

  it('puts a page state phone left of desktop and starts the next state on a new line', async () => {
    const shots = ['default', 'loading'].flatMap((state) => [
      { state: `${state} · phone`, changed: true, height: 844 },
      { state: `${state} · desktop`, changed: true, height: 900, width: 1440 },
    ]);
    const root: HTMLElement = (
      await render({ camera: '100', rows: [{ key: 'a', note: '', width: 390, perLine: 2, shots }] })
    ).nativeElement;
    const stage = root.querySelector<HTMLElement>('[data-sk-row="a"] [data-sk-stage]');

    expect(stage?.style.gridTemplateColumns).toBe('repeat(2, minmax(390px, max-content))');
  });

  it('keeps a part as wide as the window in one column', async () => {
    const wide = ROWS.map((row) => ({ ...row, width: 1440 }));
    const root: HTMLElement = (await render({ camera: '100', rows: wide })).nativeElement;

    expect(root.querySelector<HTMLElement>('[data-sk-stage]')?.style.gridTemplateColumns).toBe(
      'repeat(1, minmax(1440px, max-content))',
    );
  });

  it('turns the rows into columns for a wide part, but not for a width no frame has reported yet', async () => {
    const wide = ROWS.map((row) => ({ ...row, width: 4000 }));
    const sized: HTMLElement = (await render({ rows: wide })).nativeElement;
    const unsized: HTMLElement = (await render({ rows: wide.map((row) => ({ ...row, sized: false })) })).nativeElement;

    expect(sized.querySelector('[data-sk-matrix]')).not.toBeNull();
    expect(unsized.querySelector('[data-sk-matrix]')).toBeNull();
  });

  it('never turns the rows of a page with presets into columns', async () => {
    const wide = ROWS.map((row) => ({ ...row, width: 4000, perLine: 2 }));
    const root: HTMLElement = (await render({ rows: wide })).nativeElement;

    expect(root.querySelector('[data-sk-matrix]')).toBeNull();
  });

  it('sizes the world of a wide part to its matrix, not to the list, like the design', async () => {
    const wide = ROWS.map((row) => ({ ...row, width: 4000 }));
    const root: HTMLElement = (await render({ rows: wide })).nativeElement;
    const world = root.querySelector<HTMLElement>('[data-sk-matrix]')?.parentElement;

    expect(world?.classList.contains('w-max')).toBe(true);
    expect(world?.classList.contains('min-w-full')).toBe(false);
  });

  it('stacks the variants of wide frames when the matrix would draw them below 45 % (tomflix colors at 1440 px)', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? 1076 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? 1000 : 0;
    });
    const variant = (key: string): SketchRow => ({
      key,
      note: '',
      width: 992,
      shots: [
        { state: 'dark', changed: true, height: 1000 },
        { state: 'preview', changed: true, height: 671 },
      ],
    });
    const rows = [
      { key: 'current', note: '', width: 992, shots: [{ state: 'dark', changed: false, height: 1000 }] },
      ...['a', 'b', 'c'].map(variant),
    ];
    const fixture = await render({ part: 'foundations/colors', rows, camera: 'fit' });
    const root: HTMLElement = fixture.nativeElement;

    expect(fixture.componentInstance.transposed()).toBe(false);
    expect(root.querySelector('[data-sk-matrix]')).toBeNull();
    expect(root.querySelectorAll('[data-sk-changed] [data-sk-row]')).toHaveLength(4);
  });

  describe('matrix blocks', () => {
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-sk-rows') ? 800 : 0;
      });
    });

    const manyOf = (count: number, height: number) =>
      ROWS.map((row) => ({
        ...row,
        width: 4000,
        shots: Array.from({ length: count }, (_, index) => ({
          state: `state-${index}`,
          changed: row.key === 'x' ? true : false,
          height,
        })),
      }));
    const gutterBlocks = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLElement>('[data-sk-gutter]')].map((gutter) => gutter.dataset['skBlock']);

    it('lays the states of a matrix taller than wide in consecutive blocks side by side', async () => {
      const root: HTMLElement = (await render({ rows: manyOf(30, 900), camera: 'fit' })).nativeElement;
      const blocks = gutterBlocks(root);
      const columns = root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns ?? '';

      expect(new Set(blocks).size).toBeGreaterThan(1);
      expect(blocks.slice(0, 3)).toEqual(['0', '0', '0']);
      expect(blocks).toEqual([...blocks].sort());
      expect(root.querySelectorAll('[data-sk-matrix] [data-sk-row="x"]')).toHaveLength(new Set(blocks).size);
      expect(columns.match(/repeat\(2,/g)).toHaveLength(new Set(blocks).size);
      expect(textOf(root.querySelector('[data-sk-gutter]'))).toBe('state-0');
    });

    it('wraps 30 tall states only into blocks whose frames stay 160 px wide, and keeps few states in one block', () => {
      const options = { columns: 3, frameWidth: 1440 };
      const many = matrixBlocksOf(Array(30).fill(900), { ...options, viewport: { width: 1100, height: 720 } });
      const page = matrixBlocksOf(Array(30).fill(900), { ...options, viewport: { width: 1076, height: 740 } });
      const wider = matrixBlocksOf(Array(30).fill(900), { ...options, viewport: { width: 1570, height: 740 } });
      const few = matrixBlocksOf(Array(3).fill(900), { ...options, viewport: { width: 1100, height: 720 } });
      const unmeasured = matrixBlocksOf(Array(30).fill(900), { ...options, viewport: { width: 0, height: 0 } });

      expect(many).toEqual([30]);
      expect(page).toEqual([30]);
      expect(wider).toEqual([15, 15]);
      expect(wider.reduce((sum, size) => sum + size, 0)).toBe(30);
      expect(few).toEqual([3]);
      expect(unmeasured).toEqual([30]);
    });

    it('keeps the full head over the first block only and a name tag over the later ones', async () => {
      const root: HTMLElement = (await render({ rows: manyOf(30, 900), camera: 'fit' })).nativeElement;
      const sections = [...root.querySelectorAll<HTMLElement>('[data-sk-matrix] [data-sk-row]')];
      const first = sections.filter((section) => section.querySelector('[data-sk-note]'));

      expect(first.length).toBeGreaterThan(0);
      expect(first.length).toBeLessThan(sections.length);
      expect(
        sections.every(
          (section) => section.querySelector('[data-sk-head-tag]') || section.querySelector('[data-sk-note]'),
        ),
      ).toBe(true);
      expect(
        sections
          .filter((section) => !section.querySelector('[data-sk-note]'))
          .every((section) => (section.querySelector('[data-sk-head-tag]')?.textContent?.trim().length ?? 0) <= 3),
      ).toBe(true);
    });

    it('names the later blocks of an @edit sketch with readable tags, not initials', async () => {
      const [newSide, oldSide] = manyOf(30, 900);
      const rows = [
        { ...newSide, key: 'new' },
        { ...oldSide, key: 'old' },
      ] as SketchRow[];
      const root: HTMLElement = (
        await render({ rows, camera: 'fit', part: 'components/tree-row@edit', status: 'waiting' })
      ).nativeElement;
      const tags = [...root.querySelectorAll('[data-sk-matrix] [data-sk-row] [data-sk-head-tag]')].map(textOf);

      expect(tags.length).toBeGreaterThan(0);
      expect(new Set(tags)).toEqual(new Set([LABELS.editNew, LABELS.editOld]));
    });

    it('keeps few states in one block', async () => {
      const root: HTMLElement = (await render({ rows: manyOf(5, 40), camera: 'fit' })).nativeElement;
      const few: HTMLElement = (await render({ rows: manyOf(3, 100), camera: 'fit' })).nativeElement;

      expect(new Set(gutterBlocks(root))).toEqual(new Set(['0']));
      expect(new Set(gutterBlocks(few))).toEqual(new Set(['0']));
    });
  });

  it('keeps a variant name in the fold label on one line so no letter is left alone', () => {
    const label = LABELS.sameVariants(['Variante a', 'Variante b']);

    expect(label.split(/ /).every((part) => part.length > 1)).toBe(true);
  });

  it('keeps the fold column inside the viewport when fitting the matrix', async () => {
    const wide = [...ROWS, { ...ROWS[1]!, key: 'y', shots: ROWS[0]!.shots }].map((row) => ({ ...row, width: 4950 }));
    const columnsAt = async (foldWidth: number) => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-sk-same') ? foldWidth : 0;
      });
      const root: HTMLElement = (await render({ rows: wide, camera: 'fit' })).nativeElement;

      return root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns;
    };
    const without = await columnsAt(0);
    const withFold = await columnsAt(144);
    const widthOf = (columns: string | undefined) =>
      parseFloat(columns?.match(/repeat\(\d+, (?:max\()?([\d.]+)px/)?.[1] ?? '0');

    expect(widthOf(withFold)).toBeGreaterThan(0);
    expect(widthOf(withFold)).toBeLessThan(widthOf(without));
    expect(widthOf(withFold) * 2 + 24 + 144 + 24 + 16).toBeLessThanOrEqual(LIST_WIDTH + 1);
  });

  it('fits Aktuell and every variant column of a wide part into the viewport', async () => {
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const root: HTMLElement = (await render({ rows: wide, camera: 'fit' })).nativeElement;
    const columns = root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns;
    const width = parseFloat(columns?.match(/repeat\(4, (?:max\()?([\d.]+)px/)?.[1] ?? '0');

    expect(width).toBeGreaterThan(0);
    expect(width * 4 + 24 * 3 + 16).toBeLessThanOrEqual(LIST_WIDTH + 1);
  });

  it('sizes the notes of a user zoom by the fit of the rendered matrix, not by a fit before the list is measured', async () => {
    const resized: ResizeObserverCallback[] = [];
    let listWidth = 0;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(callback);
        }
        observe = () => undefined;
        unobserve = () => undefined;
        disconnect = () => undefined;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? listWidth : 0;
    });
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const fixture = await render({ rows: wide, camera: { zoom: 0.6, x: 0, y: 0 } });
    const root: HTMLElement = fixture.nativeElement;
    const list = root.querySelector('[data-sk-rows]')!;

    listWidth = LIST_WIDTH;
    resized.forEach((callback) => callback([{ target: list } as unknown as ResizeObserverEntry], {} as ResizeObserver));
    await fixture.whenStable();
    vi.unstubAllGlobals();

    expect(root.querySelector('[data-sk-matrix]')).not.toBeNull();
    expect(root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-note]')?.style.fontSize).toBe('12px');
  });

  it('sizes a hidden head to its tag after the fit pass', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') || this.hasAttribute('data-sk-stage') ? LIST_WIDTH : 0;
    });
    const root: HTMLElement = (await render({ camera: { zoom: 0.1, x: 0, y: 0 } })).nativeElement;
    const section = root.querySelector<HTMLElement>('section[data-sk-row="x"]');

    expect(section?.hasAttribute('data-sk-head-hidden')).toBe(true);
  });

  it('keeps the variant note readable under the tag of a hidden head', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') || this.hasAttribute('data-sk-stage') ? LIST_WIDTH : 0;
    });
    const root: HTMLElement = (await render({ camera: { zoom: 0.1, x: 0, y: 0 } })).nativeElement;
    const note = root.querySelector<HTMLElement>('section[data-sk-row="x"] [data-sk-tag-note]');

    expect(textOf(note)).toBe(ROWS[1]?.note);
    expect(note?.classList).toContain('text-ui-xs');
  });

  it('fits the matrix again when a font loads after the first fit', async () => {
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const fixture = await render({ rows: wide, camera: 'fit' });
    const root: HTMLElement = fixture.nativeElement;
    const columns = () => root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns;
    const before = columns();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(this.matches('section[data-sk-row]') ? 2000 : 0, 0, 0, 0);
    });
    fontsLoaded({} as FontFace);
    await fixture.whenStable();

    expect(columns()).not.toBe(before);
  });

  it('keeps the fit when a font load only re-reports a loaded face', async () => {
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const fixture = await render({ rows: wide, camera: 'fit' });
    const root: HTMLElement = fixture.nativeElement;
    const columns = () => root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns;
    const face = {} as FontFace;

    fontsLoaded(face);
    await fixture.whenStable();
    const before = columns();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(this.matches('section[data-sk-row]') ? 2000 : 0, 0, 0, 0);
    });
    fontsLoaded(face);
    await fixture.whenStable();

    expect(columns()).toBe(before);
  });

  it('keeps the fit when a listing answer repeats the same rows', async () => {
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const fixture = await render({ rows: wide, camera: 'fit' });
    const root: HTMLElement = fixture.nativeElement;
    const columns = () => root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns;
    const before = columns();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(this.matches('section[data-sk-row]') ? 2000 : 0, 0, 0, 0);
    });

    fixture.componentRef.setInput('rows', structuredClone(wide));
    await fixture.whenStable();

    expect(columns()).toBe(before);
  });

  it('shows a state neither dimmed nor first changed while its compare is pending', async () => {
    const pending = ROWS.map((row) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) }));
    const fixture = await render({ camera: '100', rows: pending });
    const root: HTMLElement = fixture.nativeElement;
    const statesOf = () => [...root.querySelectorAll('[data-sk-row="x"] [data-sk-state]')].map(textOf);

    expect(statesOf()).toEqual([]);
    expect(root.querySelector('[data-sk-row="current"]')).not.toBeNull();
    expect(textOf(root.querySelector('[data-sk-folded] > span > span'))).toBe(LABELS.pendingStates(2));

    fixture.componentRef.setInput('listError', 'Failed to fetch');
    await fixture.whenStable();

    expect(textOf(root.querySelector('[data-sk-folded] > span > span'))).toBe(LABELS.pendingFailed(2));

    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await fixture.whenStable();

    expect(statesOf()).toEqual(['rest', 'open']);
    expect(root.querySelector('[data-sk-row="x"] .opacity-50')).toBeNull();
    expect(root.querySelector('[data-sk-first-change]')).toBeNull();
  });

  it('marks a state a variant adds as new in Aktuell and as gone in a variant without it', async () => {
    const rows: SketchRow[] = [
      ...ROWS,
      {
        key: 'y',
        note: 'Mit Ladezustand',
        width: 400,
        shots: [...ROWS[1]!.shots, { state: 'busy', changed: true, height: 90 }],
      },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows })).nativeElement;
    const missingOf = (key: string) =>
      root.querySelector(`[data-sk-row="${key}"] [data-sk-missing][data-sk-state="busy"]`);

    expect(textOf(missingOf('current'))).toBe(`busy ${LABELS.newInSketch}`);
    expect(textOf(missingOf('x'))).toBe(`busy ${LABELS.removedIn('Variante x')}`);
    expect(missingOf('y')).toBeNull();
    expect(root.querySelector('[data-sk-row="y"] [data-sk-frame="y busy"]')).not.toBeNull();
  });

  it('shows a variant that only drops a state, with the dropped state as gone in it', async () => {
    const kept = ['changed', 'unchanged', 'same-as-rest', 'loading', 'loading-small', 'cropped', 'stacked'];
    const shotsOf = (states: string[]) => states.map((state) => ({ state, changed: false, height: 100 }));
    const rows: SketchRow[] = [
      { key: 'current', note: '', width: 400, shots: shotsOf([...kept, 'pinned']) },
      {
        key: 'a',
        note: 'Die Pins sitzen auf ihrem Punkt in der Zelle ihres Zustands; die Zelle selbst zeigt keine Pins mehr.',
        width: 400,
        shots: shotsOf(kept),
      },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows })).nativeElement;

    expect(root.querySelector('[data-sk-same]')).toBeNull();
    expect(textOf(root.querySelector('[data-sk-row="a"] [data-sk-note]'))).toBe(rows[1]!.note);
    expect(textOf(root.querySelector('[data-sk-row="a"] [data-sk-missing][data-sk-state="pinned"]'))).toBe(
      `pinned ${LABELS.removedIn('Variante a')}`,
    );
  });

  it('draws a state measured wider than its row at its own width', async () => {
    const rows: SketchRow[] = [
      ROWS[0]!,
      { ...ROWS[1]!, shots: [...ROWS[1]!.shots, { state: 'tip', changed: true, height: 90, width: 520 }] },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows })).nativeElement;
    const widthOf = (key: string) => root.querySelector<HTMLElement>(`[data-sk-frame="${key}"]`)?.style.width;

    expect(widthOf('x tip')).toBe('520px');
    expect(widthOf('x open')).toBe(`${ROWS[1]!.width}px`);
  });

  it('keeps the note and the state names at 12 px or more down to fit', async () => {
    const fixture = await render({ rows: [ROWS[1]!], camera: { zoom: 2, x: 0, y: 0 } });
    const root: HTMLElement = fixture.nativeElement;
    const sizes = () => [
      root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-note]')?.style.fontSize,
      root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-state] .font-code')?.style.fontSize,
    ];

    expect(sizes()).toEqual(['30px', '12px']);

    fixture.componentRef.setInput('camera', { zoom: 8, x: 0, y: 0 });
    await fixture.whenStable();

    expect(sizes()).toEqual(['120px', '12px']);

    fixture.componentRef.setInput('camera', { zoom: 0.25, x: 0, y: 0 });
    await fixture.whenStable();

    expect(sizes()).toEqual(['12px', '12px']);
  });

  it('keeps the state names at 12 px or more at fit', async () => {
    const fixture = await render({ camera: 'fit' });
    const name = fixture.nativeElement.querySelector('[data-sk-row="x"] [data-sk-state] .font-code');

    expect(parseFloat(name.style.fontSize)).toBeGreaterThanOrEqual(12);
  });

  it('names a row by its label in the head and the head tag, else by Aktuell and Variante', async () => {
    const named = [
      { ...ROWS[0], key: 'current', label: 'Stand' },
      { ...ROWS[1], key: 'a', label: 'Entwurf 1' },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows: named })).nativeElement;
    const plain: HTMLElement = (
      await render({
        camera: '100',
        rows: [
          { ...ROWS[0], key: 'current' },
          { ...ROWS[1], key: 'a' },
        ],
      })
    ).nativeElement;

    expect(textOf(root.querySelector('[data-sk-row="current"]'))).toContain('Stand');
    expect(textOf(root.querySelector('[data-sk-row="a"]'))).toContain('Entwurf 1');
    expect(textOf(plain.querySelector('[data-sk-row="current"]'))).toContain('Aktuell');
    expect(textOf(plain.querySelector('[data-sk-row="a"]'))).toContain('Variante a');
  });

  it('folds variants that match Aktuell in every state into one collapsed bar and opens it', async () => {
    const same: SketchRow = {
      key: 'y',
      note: 'Gleich wie heute',
      width: 400,
      shots: [
        { state: 'rest', changed: false, height: 100 },
        { state: 'open', changed: false, height: 200 },
      ],
    };
    const fixture = await render({ camera: '100', rows: [...ROWS, same, { ...same, key: 'z' }] });
    const root: HTMLElement = fixture.nativeElement;
    const bar = root.querySelector<HTMLButtonElement>('[data-sk-same] button');

    expect(textOf(bar)).toBe(LABELS.sameVariants(['Variante y', 'Variante z']).replace(/\s/g, ' '));
    expect(root.querySelector('[data-sk-row="y"]')).toBeNull();
    expect(root.querySelector('[data-sk-row="x"]')).not.toBeNull();

    bar?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.sameOpen()).toBe(true);
    expect(
      [...root.querySelectorAll('[data-sk-same] [data-sk-row]')].map((row) => row.getAttribute('data-sk-row')),
    ).toEqual(['y', 'z']);
  });

  it('folds every variant and its pin when no variant changes any state', async () => {
    const unchanged = (row: SketchRow) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: false })) });
    const base = ROWS[1] as SketchRow;
    const rows = [ROWS[0], { ...unchanged(base), key: 'a' }, { ...unchanged(base), key: 'b' }];
    const root: HTMLElement = (await render({ camera: '100', rows, pins: SKETCH_PINS })).nativeElement;

    expect(textOf(root.querySelector('[data-sk-same] button'))).toBe(
      LABELS.sameVariants(['Variante a', 'Variante b']).replace(/\s/g, ' '),
    );
    expect(root.querySelector('[data-sk-row="a"]')).toBeNull();
    expect(root.querySelector('ethlete-comment-pin')).toBeNull();
  });

  it('names a folded variant by its label like its row head', async () => {
    const unchanged = (row: SketchRow) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: false })) });
    const rows = [ROWS[0], ROWS[1], { ...unchanged(ROWS[1] as SketchRow), key: 'b', label: 'Entwurf 2' }];
    const root: HTMLElement = (await render({ camera: '100', rows })).nativeElement;

    expect(textOf(root.querySelector('[data-sk-same] button'))).toBe('Unverändert: Entwurf 2');
  });

  it('draws old of an @edit sketch as the base row, never folded as an unchanged variant', async () => {
    const unchanged = (row: SketchRow) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: false })) });
    const rows = [
      { ...unchanged(ROWS[0] as SketchRow), key: 'old' },
      { ...(ROWS[1] as SketchRow), key: 'new' },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows, part: 'components/chip@edit' })).nativeElement;

    expect(root.querySelector('[data-sk-same]')).toBeNull();
    expect(root.querySelector('[data-sk-row="old"]')).not.toBeNull();
  });

  it('keeps the placeholder in new of an @edit sketch when the only state left after the fold is one new drops', async () => {
    const same = ROWS[0]!.shots.map((shot) => ({ ...shot, changed: false }));
    const rows: SketchRow[] = [
      { ...ROWS[1]!, key: 'new', shots: same },
      { ...ROWS[1]!, key: 'old', shots: [...same, { state: 'selected', changed: true, height: 90 }] },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows, part: 'elements/variant-cell@edit' })).nativeElement;

    expect(root.querySelector('[data-sk-row="new"] [data-sk-missing][data-sk-state="selected"]')).not.toBeNull();
    expect(root.querySelector('[data-sk-row="old"] [data-sk-state="selected"]:not([data-sk-missing])')).not.toBeNull();
  });

  it('reads entfällt in the matrix cell of a state new of an @edit sketch drops', async () => {
    const rows: SketchRow[] = [
      { key: 'new', note: '', width: 4000, shots: [{ state: 'default', changed: true, height: 300 }] },
      {
        key: 'old',
        note: '',
        width: 4000,
        shots: [
          { state: 'default', changed: true, height: 300 },
          { state: 'round-note', changed: true, height: 300 },
        ],
      },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows, part: 'pages/sketches@edit' })).nativeElement;

    expect(root.querySelector('[data-sk-matrix]')).not.toBeNull();
    expect(
      textOf(
        root.querySelector('[data-sk-matrix] [data-sk-missing][data-sk-variant="new"][data-sk-state="round-note"]'),
      ),
    ).toBe(LABELS.removed);
  });

  it('folds the states neither old nor new of an @edit sketch changes', () => {
    const rows = SKETCH_EDIT_SAMPLE.rows;
    const changed = new Set(rows.flatMap((row) => row.shots.filter((shot) => shot.changed).map((shot) => shot.state)));
    const folded = foldedStatesOf(rows);

    expect(folded.size).toBeGreaterThan(0);
    expect([...folded].filter((state) => changed.has(state))).toEqual([]);
    expect(folded.size + changed.size).toBe(new Set(rows.flatMap((row) => row.shots.map((shot) => shot.state))).size);
  });

  it('mounts the frame set the shared list function gives for the rows', async () => {
    const rows = SKETCH_EDIT_SAMPLE.rows;
    const fixture = await render({ camera: '100', rows, part: 'components/chip@edit' });
    const mounted = fixture.componentInstance
      .shownRows()
      .flatMap((row) => row.shots.map((shot): [string, string] => [row.key, shot.state]));

    expect(mounted).toEqual(sketchFrameSetOf({ listed: rows }));
  });

  it('shows both named rows of an @edit sketch with a button each when new equals Aktuell', async () => {
    const unchanged = (row: SketchRow) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: false })) });
    const rows = [
      unchanged(ROWS[0] as SketchRow),
      { ...unchanged(ROWS[1] as SketchRow), key: 'old' },
      { ...unchanged(ROWS[1] as SketchRow), key: 'new' },
    ];
    const root: HTMLElement = (await render({ camera: '100', rows, part: 'components/chip@edit', status: 'waiting' }))
      .nativeElement;
    const rowOf = (key: string) => root.querySelector<HTMLElement>(`[data-sk-row="${key}"]`);

    expect(root.querySelector('[data-sk-same]')).toBeNull();
    expect(root.querySelector('[data-sk-row="current"]')).toBeNull();
    expect(textOf(rowOf('new'))).toContain(LABELS.editNew);
    expect(textOf(rowOf('old'))).toContain(LABELS.editOld);
    expect(rowOf('new')?.querySelector('[data-sk-merge]')).not.toBeNull();
    expect(rowOf('old')?.querySelector('[data-sk-merge]')).not.toBeNull();
  });

  it('puts no compare hint in the heads of an @edit sketch while old is compared', async () => {
    const pending = (row: SketchRow) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) });
    const rows = [
      { ...pending(ROWS[1] as SketchRow), key: 'new' },
      { ...pending(ROWS[1] as SketchRow), key: 'old' },
    ];
    const root: HTMLElement = (
      await render({ camera: '100', rows, part: 'components/tree-row@edit', status: 'waiting' })
    ).nativeElement;

    // Tom's decision: the view shows only the final compare, so an edit side's head carries no load hint.
    expect(root.querySelector('[data-sk-row="old"] [data-sk-comparing]')).toBeNull();
    expect(root.querySelector('[data-sk-row="new"] [data-sk-comparing]')).toBeNull();
  });

  it('holds an @edit sketch with a visible zeichnet, by opacity so live frames still paint, until its compare and the pictures of the cells in view are in, then keeps it shown', async () => {
    const side = (key: string, changed: boolean | null): SketchRow => ({
      key,
      note: '',
      width: 280,
      sized: true,
      shots: ['mark-layer', 'selected-layer'].map((state) => ({ state, changed, height: 46 })),
    });
    const rowsOf = (changed: boolean | null) => [side('new', changed), side('old', changed)];
    const fixture = await render({
      camera: '100',
      rows: rowsOf(null),
      part: 'components/tree-row@edit',
      status: 'waiting',
      nearLoadingShots: null,
    });
    const root: HTMLElement = fixture.nativeElement;
    const set = async (inputs: Record<string, unknown>) => {
      Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
      await fixture.whenStable();
    };
    const view = () => ({
      held: root.querySelector('[data-sk-rows] > .opacity-0') !== null,
      invisible: root.querySelector('[data-sk-rows] > .invisible') !== null,
      drawing: textOf(root.querySelector('[data-sk-edit-drawing]')),
      status: root.querySelector('[data-sk-toolbar] [data-sk-status]')?.getAttribute('data-sk-status'),
    });

    expect(view()).toEqual({ held: false, invisible: true, drawing: 'zeichnet', status: 'drawing' });
    await set({ rows: rowsOf(true) });
    expect(view()).toEqual({ held: true, invisible: false, drawing: 'zeichnet', status: 'drawing' });
    await set({ nearLoadingShots: new Set(['new mark-layer']) });
    expect(view()).toEqual({ held: true, invisible: false, drawing: 'zeichnet', status: 'drawing' });
    await set({ nearLoadingShots: new Set() });
    expect(view()).toEqual({ held: false, invisible: false, drawing: '', status: 'waiting' });
    await set({ nearLoadingShots: new Set(['new mark-layer']) });
    expect(view()).toEqual({ held: false, invisible: false, drawing: '', status: 'waiting' });
  });

  it('shows an @edit sketch once the cells in view are drawn, while pictures of cells out of view or not rendered still load', async () => {
    const states = Array.from({ length: 38 }, (_, index) => `state-${index}`);
    const rowOf = (key: string): SketchRow => ({
      key,
      note: '',
      width: 280,
      sized: true,
      shots: states.map((state) => ({ state, changed: true, height: 46 })),
    });
    const fixture = await render({
      camera: '100',
      rows: [rowOf('new'), rowOf('old')],
      part: 'pages/sketches@edit',
      status: 'waiting',
      loadingShots: new Set(['new', 'old'].flatMap((key) => states.map((state) => `${key} ${state}`))),
      nearLoadingShots: new Set(),
    });
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('[data-sk-rows] > .opacity-0')).toBeNull();
    expect(root.querySelector('[data-sk-edit-drawing]')).toBeNull();
  });

  it('marks the changed area on both sides of tree-row@edit', async () => {
    const change = { width: 280, height: 46, box: { x: 240, y: 14, width: 18, height: 18 }, pixels: 120, regions: 1 };
    const side = (key: string): SketchRow => ({
      key,
      note: '',
      width: 280,
      shots: ['mark-layer', 'selected-layer'].map((state) => ({ state, changed: true, height: 46, change })),
    });
    const root: HTMLElement = (
      await render({
        camera: '100',
        rows: [side('new'), side('old')],
        part: 'components/tree-row@edit',
        status: 'waiting',
      })
    ).nativeElement;
    const marksOf = (key: string) => root.querySelectorAll(`[data-sk-frame^="${key} "] [data-sk-crop-mark]`).length;

    expect([marksOf('new'), marksOf('old')]).toEqual([2, 2]);
  });

  it('keeps a folded variant folded while a quick listing knows nothing about its compare', async () => {
    const same: SketchRow = {
      key: 'y',
      note: 'Gleich wie heute',
      width: 400,
      shots: [
        { state: 'rest', changed: false, height: 100 },
        { state: 'open', changed: false, height: 200 },
      ],
    };
    const unknown = (row: SketchRow) =>
      row.key === 'current' ? row : { ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) };
    const fixture = await render({ camera: '100', rows: [...ROWS, same] });
    const root: HTMLElement = fixture.nativeElement;

    fixture.componentRef.setInput('rows', [...ROWS, same].map(unknown));
    await fixture.whenStable();

    expect(textOf(root.querySelector('[data-sk-same] button'))).toBe(
      LABELS.sameVariants(['Variante y']).replace(/\s/g, ' '),
    );
    expect(root.querySelector('[data-sk-row="y"]')).toBeNull();
    expect(root.querySelector('[data-sk-row="x"]')).not.toBeNull();

    fixture.componentRef.setInput('rows', [...ROWS, same]);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-row="y"]')).toBeNull();
  });

  it('does not carry a folded variant over to another part', async () => {
    const same: SketchRow = {
      key: 'y',
      note: 'Gleich wie heute',
      width: 400,
      shots: [{ state: 'rest', changed: false, height: 100 }],
    };
    const fixture = await render({ camera: '100', part: 'components/title-bar', rows: [...ROWS, same] });
    const root: HTMLElement = fixture.nativeElement;

    fixture.componentRef.setInput('part', 'components/zoom-chip');
    fixture.componentRef.setInput('rows', [
      ...ROWS,
      { ...same, shots: same.shots.map((shot) => ({ ...shot, changed: null })) },
    ]);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-row="y"]')).not.toBeNull();
    expect(root.querySelector('[data-sk-same]')).toBeNull();
  });

  it.each([
    ['row stage', 400, '[data-sk-stage]'],
    ['transposed matrix', 4000, '[data-sk-matrix]'],
  ] as const)('swaps the states of the %s for another part without the NG0956 warning', async (_, width, view) => {
    const rowsWith = (states: string[]) =>
      ROWS.map((row) => ({ ...row, width, shots: states.map((state) => ({ state, changed: true, height: 100 })) }));
    const warn = vi.spyOn(console, 'warn');
    const fixture = await render({ camera: '100', part: 'foundations/colors', rows: rowsWith(['light', 'dark']) });
    const root: HTMLElement = fixture.nativeElement;

    fixture.componentRef.setInput('part', 'foundations/logo');
    fixture.componentRef.setInput('rows', rowsWith(['mark', 'wordmark']));
    await fixture.whenStable();

    expect(root.querySelector(view)).not.toBeNull();
    expect(root.querySelector('[data-sk-state="mark"]')).not.toBeNull();
    expect(root.querySelector('[data-sk-state="light"]')).toBeNull();
    expect(warn.mock.calls.flat().filter((line) => String(line).includes('NG0956'))).toEqual([]);
  });

  it('keeps an unfolded variant unfolded while a quick listing knows nothing about its compare', async () => {
    const pending = ROWS.map((row) =>
      row.key === 'x' ? { ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) } : row,
    );
    const fixture = await render({ camera: '100', rows: pending });
    const root: HTMLElement = fixture.nativeElement;
    const row = root.querySelector('[data-sk-row="x"]');

    fixture.componentRef.setInput('rows', [...ROWS]);
    await fixture.whenStable();

    expect(root.querySelector('[data-sk-row="x"]')).toBe(row);
    expect(root.querySelector('[data-sk-same]')).toBeNull();
  });

  it('keeps a variant neutral and marks its head while its compare is pending', async () => {
    const pending = ROWS.map((row) =>
      row.key === 'x' ? { ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) } : row,
    );
    const root: HTMLElement = (await render({ camera: '100', rows: pending })).nativeElement;

    expect(textOf(root.querySelector('[data-sk-row="x"] [data-sk-comparing]'))).toBe(LABELS.comparing);
    expect(root.querySelector('[data-sk-row="current"] [data-sk-comparing]')).toBeNull();
    expect(root.querySelector('[data-sk-row="x"] .opacity-50')).toBeNull();
    expect(root.querySelector('[data-sk-same]')).toBeNull();
  });

  it('shows the failed listing instead of the pending mark and a retry that emits', async () => {
    const pending = ROWS.map((row) =>
      row.key === 'x' ? { ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) } : row,
    );
    const fixture = await render({ camera: '100', rows: pending, listError: 'Failed to fetch' });
    const root: HTMLElement = fixture.nativeElement;
    const retried = vi.fn();

    fixture.componentInstance.retry.subscribe(retried);

    expect(textOf(root.querySelector('[data-sk-row="x"] [data-sk-compare-failed]'))).toBe(
      LABELS.compareFailed('Failed to fetch'),
    );
    expect(root.querySelector('[data-sk-row="x"] [data-sk-comparing]')).toBeNull();

    (root.querySelector('[data-sk-retry]') as HTMLButtonElement).click();

    expect(retried).toHaveBeenCalledTimes(1);
  });

  it('offers Übernehmen only while the sketch waits for a pick', async () => {
    const waiting: HTMLElement = (await render({ camera: '100', status: 'waiting' })).nativeElement;
    const notReady: HTMLElement = (await render({ camera: '100', status: 'not-ready' })).nativeElement;

    expect(waiting.querySelector('[data-sk-toolbar] [data-sk-status]')?.getAttribute('data-sk-status')).toBe('waiting');
    expect(textOf(waiting.querySelector('[data-sk-row="x"] button'))).toBe(LABELS.merge);
    expect(notReady.querySelector('[data-sk-row="x"] button')).toBeNull();
  });

  it('keeps Übernehmen and opens the sketch points from the chip in the head of the selected variant only', async () => {
    const y = { ...ROWS[1], key: 'y', note: 'Variante y' } as SketchRow;
    const groups = [{ icon: 'grid', lines: [{ text: SYSTEM_LABELS.sketchOpen, detail: 'y' }] }];
    const fixture = await render({
      camera: '100',
      status: 'waiting',
      fresh: true,
      rows: [ROWS[1], y],
      selected: 'y',
      openPoints: groups,
      part: 'elements/rating',
    });
    const root: HTMLElement = fixture.nativeElement;
    const chip = root.querySelector<HTMLButtonElement>('[data-sk-row="y"] [data-open-points-chip]');

    expect(textOf(root.querySelector('[data-sk-row="x"] [data-sk-merge]'))).toBe(LABELS.merge);
    expect(root.querySelector('[data-sk-row="x"] [data-open-points-chip]')).toBeNull();
    expect(textOf(chip)).toBe(SYSTEM_LABELS.openCount(1));

    chip?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.pointsClosed()).toBe(false);
    expect(textOf(document.querySelector('[role="dialog"]'))).toContain(SYSTEM_LABELS.sketchOpen);
    expect(document.querySelector('[role="dialog"] ul')?.classList.contains('divide-y')).toBe(false);
  });

  it('offers no Übernehmen while a variant has an errored frame and names the error in the head', async () => {
    const y = { ...ROWS[1], key: 'y', note: 'Variante y' } as SketchRow;
    const root: HTMLElement = (
      await render({
        camera: '100',
        status: 'waiting',
        rows: [...ROWS, y],
        errored: ['x'],
        failures: { x: 'default: boom is not defined' },
      })
    ).nativeElement;

    expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')?.getAttribute('data-sk-status')).toBe('failed');
    expect(textOf(root.querySelector('[data-sk-row="x"] [data-sk-row-failed]'))).toBe(
      LABELS.rowFailed('default: boom is not defined'),
    );
    expect(root.querySelector('[data-sk-row="y"] [data-sk-row-failed]')).toBeNull();
    expect(textOf(root.querySelector('[data-sk-toolbar]'))).not.toContain('boom is not defined');
    expect(root.querySelector('[data-sk-merge]')).toBeNull();
  });

  it('offers no Übernehmen while the sketch fails', async () => {
    const waiting: HTMLElement = (await render({ camera: '100', status: 'waiting' })).nativeElement;

    expect(waiting.querySelector('[data-sk-merge]')).not.toBeNull();

    const failed: HTMLElement = (await render({ camera: '100', status: 'failed' })).nativeElement;

    expect(failed.querySelector('[data-sk-merge]')).toBeNull();
  });

  it('keeps a disabled Übernehmen in every head while the frames still draw, so the heads keep their height', async () => {
    const fixture = await render({ camera: '100', status: 'drawing' });
    const root: HTMLElement = fixture.nativeElement;
    const locked = [...root.querySelectorAll<HTMLButtonElement>('[data-sk-merge]')];

    expect(locked.length).toBeGreaterThan(0);
    expect(locked.every((button) => button.disabled)).toBe(true);
    expect(root.querySelector('[data-sk-take]')).toBeNull();

    locked[0]?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.confirm()).toBeNull();

    fixture.componentRef.setInput('status', 'waiting');
    await fixture.whenStable();
    const open = [...root.querySelectorAll<HTMLButtonElement>('[data-sk-merge]')];

    expect(open).toHaveLength(locked.length);
    expect(open.some((button) => button.disabled)).toBe(false);
  });

  it('shows a merge error under the picked variant, and in the header when no variant is picked', async () => {
    const picked: HTMLElement = (
      await render({ camera: '100', status: 'waiting', selected: 'x', error: 'zoom-chip changed' })
    ).nativeElement;

    expect(textOf(picked.querySelector('[data-sk-row="x"] [data-sk-merge-error]'))).toBe('zoom-chip changed');
    expect(picked.querySelector('ethlete-sketch-head [role="alert"]')).toBeNull();

    const unpicked: HTMLElement = (await render({ camera: '100', status: 'waiting', error: 'zoom-chip changed' }))
      .nativeElement;

    expect(unpicked.querySelector('[data-sk-merge-error]')).toBeNull();
    expect(textOf(unpicked.querySelector('ethlete-sketch-head [role="alert"]'))).toBe('zoom-chip changed');
  });

  it('opens at a restored camera and selects a clicked frame', async () => {
    mockWorldSize(LIST_WIDTH + 500, 900);
    const fixture = await render({ restoredCamera: { zoom: 0.5, x: -40, y: -60 }, statesOpen: true });
    const root: HTMLElement = fixture.nativeElement;
    const frame = root.querySelector<HTMLElement>('[data-sk-frame="x rest"]');

    expect(root.querySelector<HTMLElement>('[data-sk-rows] > div')?.style.transform).toBe(
      'translate(-40px, -60px) scale(1)',
    );
    expect(frame?.style.width).toBe('200px');

    let captured = false;

    Object.assign(root.querySelector('[data-sk-rows]') ?? {}, {
      setPointerCapture: () => (captured = true),
      hasPointerCapture: () => captured,
      releasePointerCapture: () => (captured = false),
    });
    frame?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
    frame?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
    await fixture.whenStable();

    expect(frame?.hasAttribute('data-selected')).toBe(true);
  });

  it('keeps the start camera inside the content on both axes', async () => {
    mockWorldSize(LIST_WIDTH + 300, 500);
    const transformAt = async (camera: { zoom: number; x: number; y: number }) =>
      (await render({ camera })).nativeElement.querySelector('[data-sk-rows] > div')?.style.transform;

    expect(await transformAt({ zoom: 1, x: 120, y: 80 })).toBe('translate(0px, 0px) scale(1)');
    expect(await transformAt({ zoom: 1, x: -1700, y: -260 })).toBe('translate(-300px, -260px) scale(1)');
    expect(await transformAt({ zoom: 1, x: -100, y: -2000 })).toBe('translate(-100px, -500px) scale(1)');
  });

  it('clamps the start camera again when a font load narrows the content', async () => {
    mockWorldSize(LIST_WIDTH + 2, 500);
    const fixture = await render({ camera: { zoom: 0.25, x: -4000, y: 0 } });
    const transform = () => fixture.nativeElement.querySelector('[data-sk-rows] > div')?.style.transform;

    expect(transform()).toBe('translate(-2px, 0px) scale(1)');

    mockWorldSize(LIST_WIDTH, 500);
    fontsLoaded({} as FontFace);
    await fixture.whenStable();

    expect(transform()).toBe('translate(0px, 0px) scale(1)');
  });

  describe('change crops of a wide part', () => {
    const change = {
      width: 3000,
      height: 1000,
      box: { x: 1200, y: 400, width: 600, height: 50 },
      pixels: 1358,
      regions: 3,
    };
    const states = ['rest', 'open', 'hover', 'moved'];
    const cropRows: SketchRow[] = [
      {
        key: 'current',
        note: '',
        width: 3000,
        shots: states.map((state) => ({ state, changed: false, height: 1000 })),
      },
      {
        key: 'x',
        note: 'Pillen',
        width: 3000,
        shots: [
          { state: 'rest', changed: false, height: 1000 },
          { state: 'open', changed: true, height: 1000, change },
          { state: 'hover', changed: true, height: 1000, change },
          {
            state: 'moved',
            changed: true,
            height: 1000,
            change: { ...change, box: { x: 0, y: 0, width: 3000, height: 1000 }, pixels: 90000, regions: 1 },
          },
        ],
      },
    ];

    // A change crop is labelled with a count of Stellen, not of cells.
    it('shows states with the same change once, cropped and enlarged, with the count, the reason and a locator', async () => {
      const root: HTMLElement = (await render({ rows: cropRows, camera: '100' })).nativeElement;
      const gutters = [...root.querySelectorAll('[data-sk-gutter]')];

      expect(gutters.map((gutter) => gutter.querySelector('.font-code')?.textContent)).toEqual(['open', 'moved']);
      expect(root.querySelectorAll('[data-sk-state="hover"]')).toHaveLength(0);
      expect(textOf(gutters[0]?.querySelector('[data-sk-crop-count]'))).toBe(LABELS.sameCrop(2));
      expect(textOf(gutters[0]?.querySelector('[data-sk-crop-reason]'))).toBe('1358 px in 3 Stellen · 4,6× vergrößert');
      expect(gutters[1]?.querySelector('[data-sk-crop-reason]')).toBeNull();
      expect(gutters[1]?.querySelector('[data-sk-crop-count]')).toBeNull();
      expect(gutters[1]?.querySelector('[data-sk-crop-locator]')).toBeNull();
      expect(root.querySelectorAll('[data-sk-state="rest"]')).toHaveLength(0);

      const frame = root.querySelector<HTMLElement>('[data-sk-frame="x open"]');

      expect(frame?.hasAttribute('data-sk-cropped')).toBe(true);
      expect(parseFloat(frame?.style.height ?? '')).toBeCloseTo((3000 * 98) / 648);
      expect(root.querySelector<HTMLElement>('[data-sk-frame="current open"]')?.hasAttribute('data-sk-cropped')).toBe(
        true,
      );
      expect(root.querySelectorAll('[data-sk-state="open"] [data-sk-crop-stack]')).toHaveLength(2);
      expect(root.querySelectorAll('[data-sk-state="moved"] [data-sk-crop-stack]')).toHaveLength(0);
    });

    it('draws the crop matrix like the screen design: no first change, no fold column, named stack', async () => {
      const root: HTMLElement = (await render({ rows: cropRows, camera: '100' })).nativeElement;
      const frame = root.querySelector<HTMLElement>('[data-sk-frame="x open"]');
      const edges = root.querySelector('[data-sk-state="open"] [data-sk-crop-stack]')?.parentElement;

      expect(root.querySelector('[data-sk-first-change]')).toBeNull();
      expect(root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns).not.toMatch(/auto$/);
      expect(frame?.parentElement?.classList.contains('self-start')).toBe(true);
      expect(edges).toBe(frame?.parentElement);
      expect(root.querySelector('[data-sk-state="open"] [data-sk-stack-states]')?.textContent).toMatch(/^\+ \S/);
      expect(root.querySelector('[data-sk-state="open"] [data-sk-stack-states]')?.textContent).not.toContain('open');
      expect(root.querySelector('[data-sk-state="moved"] [data-sk-stack-states]')).toBeNull();
    });

    it('draws the stack edges and the folded state names in flow under the frame, at the frame width', async () => {
      const root: HTMLElement = (await render({ rows: cropRows, camera: '100' })).nativeElement;
      const frame = root.querySelector<HTMLElement>('[data-sk-frame="x open"]');
      const edges = root.querySelector('[data-sk-state="open"] [data-sk-crop-stack]')?.parentElement;

      expect(frame?.classList.contains('z-1')).toBe(true);
      expect(edges?.classList.contains('absolute')).toBe(false);
      expect(root.querySelector<HTMLElement>('[data-sk-state="open"] [data-sk-stack-states]')?.style.width).toBe(
        frame?.style.width,
      );
      expect(root.querySelector('[data-sk-matrix]')?.parentElement?.classList.contains('min-w-full')).toBe(true);
    });

    it('names no pixels, magnification or screen toggle beside a crop that is the whole picture (tomflix colors)', async () => {
      const picture = { width: 992, height: 1000, box: { x: 16, y: 16, width: 960, height: 968 }, regions: 1 };
      const variant = (key: string, pixels: number): SketchRow => ({
        key,
        note: '',
        width: 992,
        shots: [{ state: 'dark', changed: true, height: 1000, change: { ...picture, pixels } }],
      });
      const rows: SketchRow[] = [
        { key: 'current', note: '', width: 992, shots: [{ state: 'dark', changed: false, height: 1000 }] },
        variant('a', 914156),
        variant('b', 907315),
        variant('c', 913310),
      ];

      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-sk-rows') ? 3900 : 0;
      });

      const root: HTMLElement = (await render({ rows, camera: '100' })).nativeElement;
      const gutter = root.querySelector('[data-sk-gutter]');

      expect(textOf(gutter)).toBe('dark');
      expect(gutter?.querySelector('[data-sk-crop-locator]')).toBeNull();
      expect(gutter?.querySelector('[data-sk-screen-toggle]')).toBeNull();
    });

    it('holds the first layout of a part until a row reports its size (tomflix hero at 1440, B676)', async () => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-sk-rows') ? 1440 : 0;
      });
      const shotsOf = (changed: boolean | null) =>
        ['dune', 'no-logo', 'series'].flatMap((state) => [
          { state, changed, height: 844, width: 390 },
          { state, changed, height: 680, width: 1440 },
        ]);
      const rowsOf = (sized: boolean, changed: boolean | null): SketchRow[] =>
        ['a', 'b', 'c'].map((key) => ({ key, note: '', width: 1440, perLine: 2, sized, shots: shotsOf(changed) }));
      const fixture = await render({ part: 'elements/hero', rows: rowsOf(false, null), camera: 'fit' });
      const root: HTMLElement = fixture.nativeElement;
      const held = () => root.querySelector('[data-sk-rows] > [data-sk-sizing]') !== null;
      const show = async (rows: SketchRow[]) => {
        fixture.componentRef.setInput('rows', rows);
        await fixture.whenStable();
      };

      expect(held()).toBe(true);
      await show(rowsOf(true, null));
      expect(held()).toBe(true);
      await show(rowsOf(false, true));
      expect(held()).toBe(true);
      await show(rowsOf(true, true));
      expect(held()).toBe(false);
      await show(rowsOf(false, true));
      expect(held()).toBe(false);
    });

    it('shows a part whose variants list no state at once (tomflix shell-app, every variant unloaded, B676)', async () => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-sk-rows') ? 1440 : 0;
      });
      const rows = ['a', 'b', 'c'].map((key) => ({ key, note: '', width: 1440, sized: true, shots: [] }));
      const root: HTMLElement = (await render({ part: 'elements/shell-app', rows, camera: 'fit' })).nativeElement;

      expect(root.querySelector('[data-sk-rows] > [data-sk-sizing]')).toBeNull();
    });

    it('scales each state line of the matrix to the column (tomflix colors at 1440, B676)', async () => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-sk-rows') ? 1440 : 0;
      });
      const row = (key: string): SketchRow => ({
        key,
        note: '',
        width: 3116,
        shots: [
          { state: 'surface-dark', changed: key !== 'current', height: 646, width: 638 },
          { state: 'accent-dark', changed: key !== 'current', height: 900, width: 638 },
          { state: 'contrast-dark', changed: key !== 'current', height: 630 },
        ],
      });
      const scale = 0.0629;
      const fixture = await render({
        rows: ['current', 'a', 'b', 'c'].map(row),
        camera: { zoom: scale, x: 0, y: 0 },
      });
      const root: HTMLElement = fixture.nativeElement;
      const widthOf = (frame: string) =>
        parseFloat(root.querySelector<HTMLElement>(`[data-sk-frame="${frame}"]`)?.style.width ?? '0');

      expect(fixture.componentInstance.transposed()).toBe(true);
      for (const variant of ['current', 'a', 'b', 'c']) {
        for (const state of ['surface-dark', 'accent-dark', 'contrast-dark']) {
          expect(widthOf(`${variant} ${state}`)).toBeCloseTo(3116 * scale, 3);
        }
      }
    });

    it('sizes the crop of a shot narrower than its row by the shot width (tomflix colors, B676)', async () => {
      const surface = { width: 638, height: 646, box: { x: 40, y: 40, width: 300, height: 200 }, regions: 1 };
      const variant = (key: string): SketchRow => ({
        key,
        note: '',
        width: 3116,
        shots: [
          { state: 'surface-dark', changed: true, height: 646, width: 638, change: { ...surface, pixels: 5000 } },
          { state: 'contrast-dark', changed: false, height: 630 },
        ],
      });
      const rows: SketchRow[] = [
        {
          key: 'current',
          note: '',
          width: 3116,
          shots: [
            { state: 'surface-dark', changed: false, height: 646, width: 638 },
            { state: 'contrast-dark', changed: false, height: 630 },
          ],
        },
        variant('a'),
        variant('b'),
      ];

      const root: HTMLElement = (await render({ rows, camera: '100' })).nativeElement;
      const frame = root.querySelector<HTMLElement>('[data-sk-frame="a surface-dark"]');
      const crop = cropOf(surface, surface.box);
      const scale = parseFloat(frame?.style.width ?? '0') / 638;

      expect(frame?.hasAttribute('data-sk-cropped')).toBe(true);
      expect(parseFloat(frame?.style.height ?? '0')).toBeCloseTo(((638 * crop.height) / crop.width) * scale, 3);
      expect(
        root.querySelector<HTMLElement>('[data-sk-frame="a surface-dark"] [data-sk-fit-inner] > div')?.style.transform,
      ).toContain(`translate(${-crop.x}px, ${-crop.y}px)`);
    });

    it('marks each changed area of a crop, not only the box around them all', async () => {
      const areas = [
        { x: 1200, y: 400, width: 100, height: 50 },
        { x: 1450, y: 400, width: 100, height: 50 },
        { x: 1700, y: 400, width: 100, height: 50 },
      ];
      const rows = cropRows.map((row) => ({
        ...row,
        shots: row.shots.map((shot) => (shot.change === change ? { ...shot, change: { ...change, areas } } : shot)),
      }));
      const root: HTMLElement = (await render({ rows, camera: '100' })).nativeElement;
      const marks = [...root.querySelectorAll<HTMLElement>('[data-sk-state="open"] [data-sk-crop-mark]')];

      expect(marks.map((mark) => [mark.style.left, mark.style.width])).toEqual([
        ['1196px', '108px'],
        ['1446px', '108px'],
        ['1696px', '108px'],
      ]);
    });

    it('switches one crop group to the whole screen and back', async () => {
      const fixture = await render({ rows: cropRows, camera: '100' });
      const root: HTMLElement = fixture.nativeElement;
      const toggleOf = (state: string) =>
        root
          .querySelectorAll('[data-sk-gutter]')
          [state === 'open' ? 0 : 1]?.querySelector<HTMLButtonElement>('[data-sk-screen-toggle]');

      expect(textOf(toggleOf('open'))).toBe(LABELS.wholeScreen);

      toggleOf('open')?.click();
      await fixture.whenStable();

      expect(textOf(toggleOf('open'))).toBe(LABELS.cropScreen);
      expect(root.querySelector('[data-sk-frame="x open"]')?.hasAttribute('data-sk-cropped')).toBe(false);
      expect(root.querySelector<HTMLElement>('[data-sk-frame="x open"]')?.style.height).toBe('1000px');
      expect(root.querySelector('[data-sk-state="open"] [data-sk-crop-mark]')).not.toBeNull();
      expect(root.querySelector('[data-sk-frame="x moved"]')?.hasAttribute('data-sk-cropped')).toBe(true);
      expect(textOf(root.querySelectorAll('[data-sk-crop-reason]')[0])).toBe('1358 px in 3 Stellen');

      toggleOf('open')?.click();
      await fixture.whenStable();

      expect(root.querySelector('[data-sk-frame="x open"]')?.hasAttribute('data-sk-cropped')).toBe(true);
    });

    // A crop is the union of the variant change boxes, with one reason line per variant.
    it('names each variant reason on its own line when the variants of one crop differ, one line when they agree', async () => {
      const [current, x] = cropRows;

      if (!current || !x) throw new Error('crop rows missing');

      const other = { ...change, box: { x: 100, y: 100, width: 50, height: 50 }, pixels: 420, regions: 2 };
      const y: SketchRow = {
        ...x,
        key: 'y',
        label: 'Entwurf 2',
        shots: x.shots.map((shot) => (shot.state === 'open' ? { ...shot, change: other } : shot)),
      };
      const root: HTMLElement = (await render({ rows: [current, x, y], camera: '100' })).nativeElement;
      const reasonsOf = (state: string) =>
        [
          ...([...root.querySelectorAll('[data-sk-gutter]')]
            .find((gutter) => gutter.querySelector('.font-code')?.textContent === state)
            ?.querySelectorAll('[data-sk-crop-reason]') ?? []),
        ].map(textOf);

      expect(reasonsOf('open')).toEqual([
        `${LABELS.variant('x')}: 1358 px in 3 Stellen`,
        'Entwurf 2: 420 px in 2 Stellen · 1,7× vergrößert',
      ]);
      expect(reasonsOf('hover')).toEqual(['1358 px in 3 Stellen · 4,6× vergrößert']);
    });

    it('draws the crop groups named in wholeScreens whole and reports a toggle back', async () => {
      const fixture = await render({ rows: cropRows, camera: '100', wholeScreens: ['moved'] });
      const root: HTMLElement = fixture.nativeElement;
      const reported: (readonly string[])[] = [];

      fixture.componentInstance.wholeScreens.subscribe((whole) => reported.push(whole));

      expect(root.querySelector('[data-sk-frame="x moved"]')?.hasAttribute('data-sk-cropped')).toBe(false);
      expect(root.querySelector('[data-sk-frame="x open"]')?.hasAttribute('data-sk-cropped')).toBe(true);

      root.querySelectorAll<HTMLButtonElement>('[data-sk-screen-toggle]')[0]?.click();
      await fixture.whenStable();

      expect(reported).toEqual([['moved', 'open']]);
      expect(root.querySelector('[data-sk-frame="x open"]')?.hasAttribute('data-sk-cropped')).toBe(false);
    });

    it('shows no crop for a part narrow enough for the list', async () => {
      const narrow = cropRows.map((row) => ({ ...row, width: 300 }));
      const root: HTMLElement = (await render({ rows: narrow, camera: '100' })).nativeElement;

      expect(root.querySelector('[data-sk-matrix]')).toBeNull();
      expect(root.querySelector('[data-sk-cropped]')).toBeNull();
      expect(root.querySelectorAll('[data-sk-state="hover"]')).toHaveLength(2);
    });
  });
  it('fits again when the list gets its width after the first measure while the camera is in Fit', async () => {
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    const observers: (() => void)[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: unknown) => void) {
          observers.push(() => callback([{ target: listOf() }]));
        }
        observe = () => undefined;
        disconnect = () => undefined;
        unobserve = () => undefined;
      },
    );
    let width = 0;
    let root: HTMLElement | null = null;
    const listOf = () => root?.querySelector('[data-sk-rows]');

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? width : 0;
    });
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const fixture = await render({ rows: wide, camera: 'fit' });

    root = fixture.nativeElement;
    const columnWidth = () =>
      parseFloat(
        root
          ?.querySelector<HTMLElement>('[data-sk-matrix]')
          ?.style.gridTemplateColumns.match(/repeat\(4, (?:max\()?([\d.]+)px/)?.[1] ?? '0',
      );
    const before = columnWidth();

    width = 12000;
    observers.forEach((notify) => notify());
    await fixture.whenStable();

    expect(before).toBe(0);
    expect(columnWidth()).toBe(2978);
  });

  it('fits the grid again when the viewport widens', async () => {
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    const observers: (() => void)[] = [];
    let root: HTMLElement | null = null;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: unknown) => void) {
          observers.push(() => callback([{ target: root?.querySelector('[data-sk-rows]') }]));
        }
        observe = () => undefined;
        disconnect = () => undefined;
        unobserve = () => undefined;
      },
    );
    let width = 300;

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? width : this.hasAttribute('data-sk-stage') ? width - 100 : 0;
    });
    const fixture = await render({ camera: 'fit' });

    root = fixture.nativeElement;
    const chip = () => textOf(root?.querySelector('ethlete-zoom-chip'));
    const before = chip();

    width = 1200;
    observers.forEach((notify) => notify());
    await fixture.whenStable();
    expect(before).toContain('50');
    expect(chip()).toContain('100');
  });
  it.each([
    { camera: 'fit' as const, flips: true },
    { camera: '200', flips: false },
  ])('keeps the layout when the list narrows at camera $camera unless it is in Fit', async ({ camera, flips }) => {
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    const observers: (() => void)[] = [];
    let root: HTMLElement | null = null;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: unknown) => void) {
          observers.push(() => callback([{ target: root?.querySelector('[data-sk-rows]') }]));
        }
        observe = () => undefined;
        disconnect = () => undefined;
        unobserve = () => undefined;
      },
    );
    let width = 30000;

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? width : 0;
    });
    const fixture = await render({ rows: ROWS.map((row) => ({ ...row, width: 4950 })), camera });

    root = fixture.nativeElement;
    observers.forEach((notify) => notify());
    await fixture.whenStable();
    const before = fixture.componentInstance.transposed();

    width = 12000;
    observers.forEach((notify) => notify());
    await fixture.whenStable();

    expect(before).toBe(false);
    expect(fixture.componentInstance.transposed()).toBe(flips);
  });

  // Decision human 23.11. (B703): the sketch head goes away completely; the canvas starts at the top and a toolbar floats at its bottom.
  it('draws no head above the rows and floats the toolbar at the bottom of the canvas', async () => {
    const root: HTMLElement = (await render({ camera: '100' })).nativeElement;
    const page = root.querySelector('[data-sketches-page]')!;
    const toolbar = page.querySelector('ethlete-sketch-head')!;

    expect(page.firstElementChild?.querySelector('[data-sk-rows]')).not.toBeNull();
    expect(page.querySelector('[data-sk-head]')).toBeNull();
    expect(toolbar.parentElement?.parentElement).toBe(page);
    expect(toolbar.parentElement?.classList).toContain('absolute');
    expect(toolbar.parentElement?.classList).toContain('bottom-space-3');
    expect(toolbar.parentElement?.querySelector('ethlete-zoom-chip')).not.toBeNull();
    expect(toolbar.querySelector('[role="toolbar"]')).not.toBeNull();
  });

  it('marks the sketch as drawing for a running agent or a port, with no model or port text in the toolbar', async () => {
    const agent = { by: { short: 'Haiku 5.5', id: 'claude-haiku-5-5', agent: 'claude' }, since: 'seit 9 Min' };
    const port = { merged: ['components/a'], since: 'seit 5 Min' };

    for (const inputs of [{ agent }, { port }]) {
      const root: HTMLElement = (await render({ camera: '100', status: 'waiting', ...inputs })).nativeElement;
      const toolbar = textOf(root.querySelector('[data-sk-toolbar]'));

      expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')?.getAttribute('data-sk-status')).toBe('drawing');
      expect(toolbar).not.toContain('Haiku 5.5');
      expect(toolbar).not.toContain('components/a');
      expect(toolbar).not.toContain('seit');
    }
  });

  it('names the merged parts in the note of the port round, once', async () => {
    const port = { merged: ['components/a', 'elements/c'], since: 'seit 5 Min' };
    const root: HTMLElement = (await render({ camera: '100', status: 'waiting', port })).nativeElement;
    const notes = [...root.querySelectorAll('[data-sk-round-note]')];

    expect(notes.map(textOf)).toEqual([LABELS.mergePort(port.merged)]);
    expect(textOf(notes[0])).toContain('components/a, elements/c');

    const plain: HTMLElement = (await render({ camera: '100', status: 'waiting' })).nativeElement;

    expect(plain.querySelector('[data-sk-round-note]')).toBeNull();
  });

  it('shows no agent-written round note in the pick view', async () => {
    // The human rejected agent prose above the canvas (B741, 25.11.); only the tool's port line may show.
    const note = 'Kommentar-Pins stehen auf der Sketch-Seite in ihrer Zelle statt als eigener Zustand der Zelle.';
    const rounds = [{ value: 'r1', label: 'Runde 1 · Pins in der Zelle', note }];
    const root: HTMLElement = (await render({ camera: '100', rounds, round: 'r1' })).nativeElement;

    expect(root.querySelector('[data-sk-round-note]')).toBeNull();
    expect(textOf(root)).not.toContain(note);
  });

  it('keeps the sketch status for a failed agent run', async () => {
    const agent = {
      by: { short: 'Haiku 5.5', id: 'claude-haiku-5-5', agent: 'claude' },
      since: 'vor 1 Min',
      failure: 'Runde 3 fehlgeschlagen',
    };
    const root: HTMLElement = (await render({ camera: '100', status: 'waiting', agent })).nativeElement;
    const toolbar = textOf(root.querySelector('[data-sk-toolbar]'));

    expect(root.querySelector('[data-sk-toolbar] [data-sk-status]')?.getAttribute('data-sk-status')).toBe('waiting');
    expect(toolbar).not.toContain('Runde 3 fehlgeschlagen');
    expect(toolbar).not.toContain('Haiku 5.5');
  });
});
