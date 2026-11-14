import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { SketchesComponent, foldedStatesOf } from './sketches.component';
import { SKETCH_EDIT_SAMPLE, SKETCH_PINS, SketchRow } from './sketches-sample';

const withTooltip = (root: Element | null | undefined, text: string) =>
  [...(root?.querySelectorAll<HTMLElement>('[aria-describedby]') ?? [])].find((element) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .some((id) => document.getElementById(id)?.textContent?.trim() === text),
  ) ?? null;

const LABELS = STUDIO_LABELS.sketches;

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

  it('heads a sketch with the part key, or with its title when it has one', async () => {
    const headOf = (root: HTMLElement) => textOf(root.querySelector('header > span'));
    const plain: HTMLElement = (await render({ camera: '100', rows: ROWS, part: 'elements/variant-cell@x' }))
      .nativeElement;

    expect(headOf(plain)).toBe('elements/variant-cell@x');

    const titled: HTMLElement = (
      await render({
        camera: '100',
        rows: ROWS,
        part: 'pages/sketches@x',
        heading: 'Ein langer Rundentitel für vier Teile',
      })
    ).nativeElement;

    expect(headOf(titled)).toBe('Ein langer Rundentitel für vier Teile');
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
    expect(states[0]?.classList.contains('opacity-50')).toBe(true);
    expect(states[1]?.classList.contains('opacity-50')).toBe(false);
    expect(textOf(variant?.querySelector('[data-sk-first-change]'))).toBe(LABELS.firstChange);
    expect(root.querySelector('[data-sk-row="current"] [data-sk-first-change]')).toBeNull();
    expect(root.querySelector('[data-sk-row="current"] .opacity-50')).toBeNull();
  });

  it('folds the states every variant draws like Aktuell, never a pending one, and shows all from the toggle', async () => {
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

    expect(framesOf()).toEqual(['x open', 'x busy']);
    expect(root.querySelector('[data-sk-row="current"] [data-sk-frame="current rest"]')).toBeNull();
    expect(textOf(root.querySelector('[data-sk-folded] > span > span'))).toBe(LABELS.foldedStates(1));
    expect(textOf(root.querySelector('[data-sk-folded] button'))).toBe(LABELS.showAllStates);
    expect(textOf(root.querySelector('[data-sk-question]'))).toBe('Wo steht der Status?');

    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await fixture.whenStable();

    expect(framesOf()).toEqual(['x rest', 'x open', 'x busy']);
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

    expect(textOf(root.querySelector('[data-sk-question]'))).toBe('Wo steht der Status?');
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

  it('says once why an unchanged sketch did not merge itself and what clears it', async () => {
    const hold = { reason: 'studio has uncommitted edits', dirty: ['pages/home/home.ts', 'shared/x.ts'] };
    const rows = [...ROWS, { ...ROWS[1]!, key: 'y' }].map((row) => ({
      ...row,
      shots: row.shots.map((shot) => ({ ...shot, changed: false })),
    }));
    const root: HTMLElement = (await render({ camera: '100', status: 'waiting', rows, mergeHold: hold })).nativeElement;

    expect(root.querySelectorAll('[data-sk-merge-hold]').length).toBe(1);
    expect(textOf(root.querySelector('[data-sk-merge-hold]'))).toBe(LABELS.mergeHold(hold));
    expect(textOf(root.querySelector('[data-sk-merge-hold]'))).toContain('pages/home/home.ts, shared/x.ts');
    expect(root.querySelector('[data-sk-merge]')).toBeNull();
  });

  it('shows no merge notice for a sketch whose variant changes a picture', async () => {
    const root: HTMLElement = (
      await render({ camera: '100', status: 'waiting', mergeHold: { reason: 'variant x changes open' } })
    ).nativeElement;

    expect(root.querySelector('[data-sk-merge-hold]')).toBeNull();
  });

  it('shows the short model name with the full id and time as its tooltip', async () => {
    const root: HTMLElement = (await render({})).nativeElement;
    const model = withTooltip(root.querySelector('[data-sk-row="x"]'), 'claude-sonnet-5-5 · 01.11. 09:00');

    expect(textOf(model)).toBe('Sonnet 5.5');
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
      'Vom Agent zurückgezogen: Zu breit für die Leiste',
    );
    expect(textOf(root.querySelector('[data-sk-row="z"] [data-sk-withdrawn]'))).toBe('Vom Agent zurückgezogen');
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

  it('emits merge with the variant from Übernehmen', async () => {
    const fixture = await render({});
    const merged: string[] = [];

    fixture.componentInstance.merge.subscribe((variant) => merged.push(variant));

    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];

    buttons.find((button) => textOf(button) === LABELS.merge)?.click();

    expect(merged).toEqual(['x']);
  });

  it('drops the current row and shows neu for a new part', async () => {
    const root: HTMLElement = (await render({ fresh: true })).nativeElement;

    expect(root.querySelector('[data-sk-row="current"]')).toBeNull();
    expect(textOf(root.querySelector('header'))).toContain(LABELS.fresh);
  });

  it('offers Verwerfen on a sketch, but not on the old/new sketch of a direct edit', async () => {
    const buttons = (root: HTMLElement) => [...root.querySelectorAll('header button')].map(textOf);

    expect(buttons((await render({ part: 'components/card' })).nativeElement)).toContain(LABELS.discard);
    const edit: HTMLElement = (await render({ part: 'components/card@edit' })).nativeElement;

    expect(buttons(edit)).not.toContain(LABELS.discard);
    expect(textOf(edit.querySelector('[data-sk-edit-hint]'))).toBe(LABELS.editHint);
  });

  it('discards only after the confirm, and Abbrechen keeps the sketch', async () => {
    const fixture = await render({ part: 'components/card' });
    const discarded = vi.fn();
    const discardButton = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('header button'),
    ].find((button) => textOf(button) === LABELS.discard);
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

    await press('[data-sk-discard-cancel]');
    expect(discarded).not.toHaveBeenCalled();

    await open();
    await press('[data-sk-discard-confirm]');
    expect(discarded).toHaveBeenCalledTimes(1);
  });

  it('shows In Arbeit and the drawing placeholder for the drawn variant', async () => {
    const root: HTMLElement = (await render({ status: 'drawing', drawn: 'x' })).nativeElement;

    expect(textOf(root.querySelector('header'))).toContain(LABELS.status.drawing);
    expect(textOf(root.querySelector('[data-sk-row="x"] [data-sk-placeholder-row]'))).toContain(
      `Sonnet 5.5 ${LABELS.drawingVariant}`,
    );
    expect(root.querySelector('[data-sk-row="x"] [data-sk-stage]')).toBeNull();
    expect(textOf(root.querySelector('[data-sk-row="x"]'))).toContain(LABELS.drawingMark);
  });

  it('toggles the hold reason of a paused sketch', async () => {
    const fixture = await render({ status: 'paused' });
    const root: HTMLElement = fixture.nativeElement;
    const reason = () => root.querySelector<HTMLElement>('[data-sk-hold-reason]');

    expect(reason()?.hidden).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-sk-hold]')?.click();
    await fixture.whenStable();

    expect(reason()?.hidden).toBe(false);
    expect(textOf(reason())).toContain(LABELS.holdUntil('B34/B36/B38'));
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
    expect(stage?.style.gridTemplateColumns).toBe('repeat(2, 400px)');
  });

  it('keeps a part as wide as the window in one column', async () => {
    const wide = ROWS.map((row) => ({ ...row, width: 1440 }));
    const root: HTMLElement = (await render({ camera: '100', rows: wide })).nativeElement;

    expect(root.querySelector<HTMLElement>('[data-sk-stage]')?.style.gridTemplateColumns).toBe('repeat(1, 1440px)');
  });

  it('turns the rows into columns for a wide part, but not for a width no frame has reported yet', async () => {
    const wide = ROWS.map((row) => ({ ...row, width: 4000 }));
    const sized: HTMLElement = (await render({ rows: wide })).nativeElement;
    const unsized: HTMLElement = (await render({ rows: wide.map((row) => ({ ...row, sized: false })) })).nativeElement;

    expect(sized.querySelector('[data-sk-matrix]')).not.toBeNull();
    expect(unsized.querySelector('[data-sk-matrix]')).toBeNull();
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
      parseFloat(columns?.match(/repeat\(\d+, ([\d.]+)px\)/)?.[1] ?? '0');

    expect(widthOf(withFold)).toBeGreaterThan(0);
    expect(widthOf(withFold)).toBeLessThan(widthOf(without));
    expect(widthOf(withFold) * 2 + 24 + 144 + 24 + 16).toBeLessThanOrEqual(LIST_WIDTH + 1);
  });

  it('fits Aktuell and every variant column of a wide part into the viewport', async () => {
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const root: HTMLElement = (await render({ rows: wide, camera: 'fit' })).nativeElement;
    const columns = root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns;
    const width = parseFloat(columns?.match(/repeat\(4, ([\d.]+)px\)/)?.[1] ?? '0');

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

  it('fits the matrix again when a font loads after the first fit', async () => {
    const wide = [...ROWS, ...['y', 'z'].map((key) => ({ ...ROWS[1]!, key }))].map((row) => ({ ...row, width: 4950 }));
    const fixture = await render({ rows: wide, camera: 'fit' });
    const root: HTMLElement = fixture.nativeElement;
    const columns = () => root.querySelector<HTMLElement>('[data-sk-matrix]')?.style.gridTemplateColumns;
    const before = columns();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(this.matches('section[data-sk-row]') ? 2000 : 0, 0, 0, 0);
    });
    document.fonts.dispatchEvent(new Event('loadingdone'));
    await fixture.whenStable();

    expect(columns()).not.toBe(before);
  });

  it('shows a state neither dimmed nor first changed while its compare is pending', async () => {
    const pending = ROWS.map((row) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) }));
    const root: HTMLElement = (await render({ camera: '100', rows: pending })).nativeElement;
    const states = [...root.querySelectorAll('[data-sk-row="x"] [data-sk-state]')];

    expect(states.map(textOf)).toEqual(['rest', 'open']);
    expect(root.querySelector('[data-sk-row="x"] .opacity-50')).toBeNull();
    expect(root.querySelector('[data-sk-first-change]')).toBeNull();
  });

  it('keeps the note and the state names at 12 px or more down to fit', async () => {
    const fixture = await render({ camera: { zoom: 2, x: 0, y: 0 } });
    const root: HTMLElement = fixture.nativeElement;
    const sizes = () => [
      root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-note]')?.style.fontSize,
      root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-state] .font-code')?.style.fontSize,
    ];

    expect(sizes()).toEqual(['30px', '26px']);
    expect(root.querySelector<HTMLElement>('[data-sk-row="x"]')?.style.gridTemplateColumns).toBe(
      '576px minmax(0, 1fr)',
    );

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

  it('folds the states neither old nor new of an @edit sketch changes', () => {
    const rows = SKETCH_EDIT_SAMPLE.rows;
    const changed = new Set(rows.flatMap((row) => row.shots.filter((shot) => shot.changed).map((shot) => shot.state)));
    const folded = foldedStatesOf(rows);

    expect(folded.size).toBeGreaterThan(0);
    expect([...folded].filter((state) => changed.has(state))).toEqual([]);
    expect(folded.size + changed.size).toBe(new Set(rows.flatMap((row) => row.shots.map((shot) => shot.state))).size);
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
    const idle: HTMLElement = (await render({ camera: '100', status: 'idle' })).nativeElement;

    expect(textOf(waiting.querySelector('header et-badge'))).toBe(LABELS.status.waiting);
    expect(textOf(waiting.querySelector('[data-sk-row="x"] button'))).toBe(LABELS.merge);
    expect(idle.querySelector('[data-sk-row="x"] button')).toBeNull();
  });

  it('keeps Übernehmen after a pick and opens the sketch points from the chip in the head of the picked variant only', async () => {
    const y = { ...ROWS[1], key: 'y', note: 'Variante y' } as SketchRow;
    const groups = [{ icon: 'error', lines: [{ text: STUDIO_LABELS.system.sketchProblem('NO-HEX'), detail: 'y' }] }];
    const fixture = await render({
      camera: '100',
      status: 'picked',
      fresh: true,
      rows: [ROWS[1], y],
      selected: 'y',
      openPoints: groups,
      part: 'elements/rating',
    });
    const root: HTMLElement = fixture.nativeElement;
    const chip = root.querySelector<HTMLButtonElement>('[data-sk-row="y"] [data-open-points-chip]');

    expect(textOf(root.querySelector('header [data-sk-picked]'))).toBe(LABELS.status.picked);
    expect(textOf(root.querySelector('[data-sk-row="x"] [data-sk-merge]'))).toBe(LABELS.merge);
    expect(root.querySelector('[data-sk-row="x"] [data-open-points-chip]')).toBeNull();
    expect(textOf(chip)).toBe(STUDIO_LABELS.system.openCount(1));

    chip?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.pointsClosed()).toBe(false);
    expect(textOf(document.querySelector('[role="dialog"]'))).toContain(STUDIO_LABELS.system.sketchProblem('NO-HEX'));
    expect(document.querySelector('[role="dialog"] ul')?.classList.contains('divide-y')).toBe(false);
  });

  it('offers no Übernehmen for a variant with an errored frame and says the round has a render error', async () => {
    const y = { ...ROWS[1], key: 'y', note: 'Variante y' } as SketchRow;
    const root: HTMLElement = (await render({ camera: '100', status: 'waiting', rows: [...ROWS, y], errored: ['x'] }))
      .nativeElement;

    expect(textOf(root.querySelector('header et-badge'))).toBe(LABELS.status.errored);
    expect(root.querySelector('[data-sk-row="x"] [data-sk-merge]')).toBeNull();
    expect(textOf(root.querySelector('[data-sk-row="y"] [data-sk-merge]'))).toBe(LABELS.merge);
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

    it('shows states with the same change once, cropped and enlarged, with the count, the reason and a locator', async () => {
      const root: HTMLElement = (await render({ rows: cropRows, camera: '100' })).nativeElement;
      const gutters = [...root.querySelectorAll('[data-sk-gutter]')];

      expect(gutters.map((gutter) => gutter.querySelector('.font-code')?.textContent)).toEqual(['open', 'moved']);
      expect(root.querySelectorAll('[data-sk-state="hover"]')).toHaveLength(0);
      expect(textOf(gutters[0]?.querySelector('[data-sk-crop-count]'))).toBe(LABELS.sameCrop(2));
      expect(textOf(gutters[0]?.querySelector('[data-sk-crop-reason]'))).toBe('1358 px in 3 Stellen · 4,6× vergrößert');
      expect(textOf(gutters[1]?.querySelector('[data-sk-crop-reason]'))).toBe('90000 px in 1 Stelle · 1,0× vergrößert');
      expect(gutters[1]?.querySelector('[data-sk-crop-count]')).toBeNull();
      expect(gutters[1]?.querySelector('[data-sk-crop-locator]')).not.toBeNull();
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

    it('draws the crop groups named in wholeScreens whole and reports a toggle back', async () => {
      const fixture = await render({ rows: cropRows, camera: '100', wholeScreens: ['moved'] });
      const root: HTMLElement = fixture.nativeElement;
      const reported: (readonly string[])[] = [];

      fixture.componentInstance.wholeScreens.subscribe((whole) => reported.push(whole));

      expect(root.querySelector('[data-sk-frame="x moved"]')?.hasAttribute('data-sk-cropped')).toBe(false);
      expect(root.querySelector('[data-sk-frame="x open"]')?.hasAttribute('data-sk-cropped')).toBe(true);
      expect(textOf(root.querySelectorAll('[data-sk-screen-toggle]')[1])).toBe(LABELS.cropScreen);

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
          ?.style.gridTemplateColumns.match(/repeat\(4, ([\d.]+)px\)/)?.[1] ?? '0',
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
    expect(before).toContain('33');
    expect(chip()).toContain('100');
  });
});
