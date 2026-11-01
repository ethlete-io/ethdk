import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { AreaRound, ChangedArea, changedAreaShownByDefault, changedAreaViewOf } from './changed-area';
import { MatrixColumn } from './system-tree';

const FRAME = { width: 1440, height: 900 };
const SMALL: ChangedArea = { frame: FRAME, crops: [{ x: 80, y: 182, width: 72, height: 54 }] };
const LARGE: ChangedArea = { frame: FRAME, crops: [{ x: 0, y: 0, width: 1440, height: 460 }] };

const frameOf = (column: string, state = 'default'): CanvasFrame => ({
  id: `${column} ${state}`,
  src: `/${column}`,
  label: 'desktop',
  width: 1440,
  height: 900,
  column,
  row: `round r2 ${state}`,
});

const group = { key: 'round r2', label: 'r2 · Switch sizing', title: 'Fold r2', note: 'Two switch sizes' };

const columns: MatrixColumn[] = [
  { key: 'current', label: 'current', drawing: false, section: 'round r2' },
  { key: 'a', label: 'a', drawing: false, note: '32 × 18', group, section: 'round r2' },
  { key: 'b', label: 'b · rejected', drawing: false, note: '40 × 22', group, section: 'round r2' },
  { key: 'in context a', label: 'a', drawing: false, section: 'in context' },
];

const rounds: AreaRound[] = [{ key: 'r2', group: 'round r2', columns: ['current', 'a', 'b'] }];

const frames = [
  frameOf('current'),
  frameOf('a'),
  frameOf('a', 'empty'),
  frameOf('b'),
  { ...frameOf('in context a'), row: 'in context pages/inbox' },
];

const viewOf = (areas: Record<string, ChangedArea | null>, choices: Record<string, boolean> = {}) =>
  changedAreaViewOf({ frames, columns, rounds, areas, choices });

const switchOf = (view: ReturnType<typeof viewOf>) =>
  view.columns.find((column) => column.group?.key === 'round r2')?.group?.switch;

describe('changedAreaShownByDefault', () => {
  it('shows the changed area while it covers less than half of the frame', () => {
    expect(changedAreaShownByDefault(SMALL)).toBe(true);
    expect(changedAreaShownByDefault({ frame: FRAME, crops: [{ x: 0, y: 0, width: 1440, height: 449 }] })).toBe(true);
    expect(changedAreaShownByDefault({ frame: FRAME, crops: [{ x: 0, y: 0, width: 1440, height: 450 }] })).toBe(false);
    expect(changedAreaShownByDefault(LARGE)).toBe(false);
  });
});

describe('changedAreaViewOf', () => {
  it('crops current and every variant of the round, rejected ones too, to one crop at one scale', () => {
    const view = viewOf({ r2: SMALL });
    const cropped = view.frames.filter((frame) => frame.crop);

    expect(cropped.map((frame) => frame.id)).toEqual(['current default', 'a default', 'a empty', 'b default']);
    expect(new Set(cropped.map((frame) => JSON.stringify([frame.crop, frame.width, frame.height]))).size).toBe(1);
    expect(cropped[0]?.crop).toEqual({ areas: SMALL.crops, frame: FRAME });
    expect(cropped[0]?.width).toBe(1440);
    expect(cropped[0]?.height).toBe(180 + 24 + 54 * 2);
    expect(view.frames.find((frame) => frame.column === 'in context a')?.crop).toBeUndefined();
    expect(switchOf(view)).toMatchObject({ label: 'Geänderter Bereich', on: true });
  });

  it('stacks one enlarged crop per cluster of changes below the small whole page', () => {
    const crops = [
      { x: 80, y: 20, width: 72, height: 54 },
      { x: 80, y: 800, width: 144, height: 36 },
    ];
    const [first] = viewOf({ r2: { frame: FRAME, crops } }).frames.filter((frame) => frame.crop);

    expect(first?.crop?.areas).toEqual(crops);
    expect(first?.height).toBe(180 + 24 + 54 * 2 + 24 + 36 * 2);
  });

  it('keeps the whole page by default when the changed area covers half of the frame or more', () => {
    const view = viewOf({ r2: LARGE });

    expect(view.frames.some((frame) => frame.crop)).toBe(false);
    expect(switchOf(view)).toMatchObject({ on: false });
  });

  it('follows the choice of the user over the default', () => {
    expect(viewOf({ r2: SMALL }, { r2: false }).frames.some((frame) => frame.crop)).toBe(false);
    expect(viewOf({ r2: LARGE }, { r2: true }).frames.filter((frame) => frame.crop)).toHaveLength(4);
  });

  it('offers no switch and crops nothing when no pixel changes', () => {
    const view = viewOf({ r2: null });

    expect(view.frames).toEqual(frames);
    expect(switchOf(view)).toBeUndefined();
    expect(view.toolbar).toBeNull();
  });

  it('hangs each variant note below the last frame of its column and leaves the round header its title only', () => {
    const view = viewOf({ r2: SMALL });

    expect(view.notes).toEqual([
      { id: 'column note a', text: '32 × 18', frameId: 'a empty', everyZoom: true },
      { id: 'column note b', text: '40 × 22', frameId: 'b default', everyZoom: true },
    ]);
    expect(view.columns.map((column) => column.note)).toEqual([undefined, undefined, undefined, undefined]);
    expect(view.columns[1]?.group).toEqual({
      key: 'round r2',
      label: 'r2 · Switch sizing',
      title: 'Fold r2',
      switch: expect.objectContaining({ on: true }),
    });
  });

  it('keeps the note on the head of a column without frames', () => {
    const view = changedAreaViewOf({
      frames: [frameOf('current')],
      columns: [{ key: 'c', label: 'c · drawing …', drawing: true, note: 'Still drawing' }],
      rounds: [],
      areas: {},
      choices: {},
    });

    expect(view.notes).toEqual([]);
    expect(view.columns[0]?.note).toBe('Still drawing');
  });

  it('puts the switch into the toolbar when the round has no header', () => {
    const headless = changedAreaViewOf({
      frames,
      columns: columns.map(({ key, label, drawing, section }) => ({
        key,
        label,
        drawing,
        ...(section ? { section } : {}),
      })),
      rounds: [{ key: 'r1', group: 'round r1', columns: ['current', 'a', 'b'] }],
      areas: { r1: SMALL },
      choices: {},
    });

    expect(headless.toolbar).toMatchObject({ key: 'r1', on: true });
    expect(headless.frames.filter((frame) => frame.crop)).toHaveLength(4);
    expect(viewOf({ r2: SMALL }).toolbar).toBeNull();
  });
});
