import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { SketchesComponent } from './sketches.component';
import { SketchRow } from './sketches-sample';

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

describe('SketchesComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sk-rows') ? LIST_WIDTH : 0;
    });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });
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
    expect(textOf(root.querySelector('[data-sk-folded] > span'))).toBe(LABELS.foldedStates(1));
    expect(textOf(root.querySelector('[data-sk-folded] button'))).toBe(LABELS.showAllStates);
    expect(textOf(root.querySelector('[data-sk-question]'))).toBe('Wo steht der Status?');

    root.querySelector<HTMLButtonElement>('[data-sk-folded] button')?.click();
    await fixture.whenStable();

    expect(framesOf()).toEqual(['x rest', 'x open', 'x busy']);
  });

  it('folds no state when every state draws like Aktuell', async () => {
    const rows = ROWS.map((row) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: false })) }));
    const root: HTMLElement = (await render({ rows, camera: '100', sameOpen: true })).nativeElement;

    expect(root.querySelector('[data-sk-folded]')).toBeNull();
    expect(root.querySelectorAll('[data-sk-row="x"] [data-sk-frame]').length).toBe(2);
  });

  it('shows the short model name with the full id and time as its title', async () => {
    const root: HTMLElement = (await render({})).nativeElement;
    const model = root.querySelector<HTMLElement>('[data-sk-row="x"] [title]');

    expect(textOf(model)).toBe('Sonnet 5.5');
    expect(model?.title).toBe('claude-sonnet-5-5 · 01.11. 09:00');
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
    const frame = root.querySelector<HTMLElement>('[data-sk-row="x"] [data-sk-state="open"] .overflow-hidden');

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

  it('shows a state neither dimmed nor first changed while its compare is pending', async () => {
    const pending = ROWS.map((row) => ({ ...row, shots: row.shots.map((shot) => ({ ...shot, changed: null })) }));
    const root: HTMLElement = (await render({ camera: '100', rows: pending })).nativeElement;
    const states = [...root.querySelectorAll('[data-sk-row="x"] [data-sk-state]')];

    expect(states.map(textOf)).toEqual(['rest', 'open']);
    expect(root.querySelector('[data-sk-row="x"] .opacity-50')).toBeNull();
    expect(root.querySelector('[data-sk-first-change]')).toBeNull();
  });

  it('keeps the note at 12 px or more and hides state labels below 9 px', async () => {
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

    expect(sizes()[0]).toBe('12px');
    expect(root.querySelector('[data-sk-row="x"] [data-sk-state] .font-code')?.parentElement?.classList).toContain(
      'hidden',
    );

    fixture.componentRef.setInput('camera', { zoom: 0.7, x: 0, y: 0 });
    await fixture.whenStable();

    expect(sizes()[1]).toBe(`${13 * 0.7}px`);
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

    expect(textOf(bar)).toBe(LABELS.sameVariants(['y', 'z']));
    expect(root.querySelector('[data-sk-row="y"]')).toBeNull();
    expect(root.querySelector('[data-sk-row="x"]')).not.toBeNull();

    bar?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.sameOpen()).toBe(true);
    expect(
      [...root.querySelectorAll('[data-sk-same] [data-sk-row]')].map((row) => row.getAttribute('data-sk-row')),
    ).toEqual(['y', 'z']);
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

    expect(textOf(root.querySelector('[data-sk-same] button'))).toBe(LABELS.sameVariants(['y']));
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

  it('offers no Übernehmen for a variant with an errored frame and says the round has a render error', async () => {
    const y = { ...ROWS[1], key: 'y', note: 'Variante y' } as SketchRow;
    const root: HTMLElement = (await render({ camera: '100', status: 'waiting', rows: [...ROWS, y], errored: ['x'] }))
      .nativeElement;

    expect(textOf(root.querySelector('header et-badge'))).toBe(LABELS.status.errored);
    expect(root.querySelector('[data-sk-row="x"] [data-sk-merge]')).toBeNull();
    expect(textOf(root.querySelector('[data-sk-row="y"] [data-sk-merge]'))).toBe(LABELS.merge);
  });

  it('opens at a restored camera and selects a clicked frame', async () => {
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

  it('opens at a camera panned past the top-left of the content', async () => {
    const root: HTMLElement = (await render({ camera: { zoom: 1, x: 120, y: 80 } })).nativeElement;

    expect(root.querySelector<HTMLElement>('[data-sk-rows] > div')?.style.transform).toBe(
      'translate(120px, 80px) scale(1)',
    );
  });
});
