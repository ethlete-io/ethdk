import { html, withAction } from '@design-system';
import button from '@system/components/button';
import titleBar from '@system/components/title-bar';
import zoomChip from '@system/components/zoom-chip';
import { panInsideRoom } from '../../../../../../apps/ethlete-studio/src/app/components/design-canvas/canvas-math';
import { variantCell } from '@system/elements/variant-cell';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';

export type RowKey = 'current' | 'a' | 'b' | 'c';

type Model = { short: string; id: string; agent: Agent; when: string };

export type Row = {
  key: RowKey;
  note: string;
  model?: Model;
  changed: string[];
  look: string;
};

type Render = { body: string; styles: string };

export type SketchPart = {
  key: string;
  width: number;
  states: string[];
  rows: Row[];
  render: (state: string) => Promise<Render>;
};

export type PartKind = 'wide' | 'narrow';

const OPUS: Omit<Model, 'when'> = { short: 'Opus 5.5', id: 'claude-opus-5-5', agent: 'claude' };
const SOL: Omit<Model, 'when'> = { short: 'GPT-6.1 Sol', id: 'gpt-6.1-sol', agent: 'codex' };

const WIDE_STATES = ['linux-close', 'linux-close-update', 'windows', 'windows-update', 'macos', 'macos-update'];

type TitleBarProps = Parameters<typeof titleBar.render>[0];
type ZoomChipProps = Parameters<typeof zoomChip.render>[0];

const titleBarStates = titleBar.states as Record<string, TitleBarProps>;
const zoomChipStates = zoomChip.states as Record<string, ZoomChipProps>;

const STEADY = ['fit-hover', 'fit-active', 'fit-focus-visible'];
const NARROW_STATES = Object.keys(zoomChipStates).filter((name) => name.startsWith('reset') || name.startsWith('fit'));

export const PARTS: Record<PartKind, SketchPart> = {
  wide: {
    key: 'components/title-bar',
    width: 1440,
    states: WIDE_STATES,
    render: async (state) => (await titleBar.render(titleBarStates[state] as TitleBarProps)) as Render,
    rows: [
      { key: 'current', note: 'Gemergter Stand', changed: [], look: '' },
      {
        key: 'a',
        note: 'Update als schmaler Button direkt neben der Suche, die Suche wird dafür schmaler; ohne Update bleibt die Leiste wie heute.',
        model: { ...OPUS, when: '02.11. 10:14' },
        changed: ['linux-close-update', 'windows-update', 'macos-update'],
        look: '[&_.w-2xl]:w-55',
      },
      {
        key: 'b',
        note: 'Leiste 40 px hoch, damit Suche und Fensterknöpfe mehr Luft haben; kostet 8 px Höhe in jeder Ansicht.',
        model: { ...SOL, when: '02.11. 10:21' },
        changed: [...WIDE_STATES],
        look: '[&_.st-title-bar]:h-10',
      },
      {
        key: 'c',
        note: 'Unter macOS rückt die Suche nach links an die Ampel, Linux und Windows bleiben gleich.',
        model: { ...OPUS, when: '02.11. 10:30' },
        changed: ['macos', 'macos-update'],
        look: '[&_.st-title-bar]:grid-cols-[auto_1fr_auto]',
      },
    ],
  },
  narrow: {
    key: 'components/zoom-chip',
    width: 176,
    states: NARROW_STATES,
    render: async (state) => (await zoomChip.render(zoomChipStates[state] as ZoomChipProps)) as Render,
    rows: [
      { key: 'current', note: 'Gemergter Stand', changed: [], look: '' },
      {
        key: 'a',
        note: 'Chip als Pille, die Knöpfe rücken enger zusammen.',
        model: { ...OPUS, when: '02.11. 11:02' },
        changed: NARROW_STATES.filter((name) => name.startsWith('fit') && !STEADY.includes(name)),
        look: '**:data-canvas-zoom:rounded-full',
      },
      {
        key: 'b',
        note: 'Prozentzahl in Halbfett, damit der Zoom auf einen Blick lesbar ist.',
        model: { ...SOL, when: '02.11. 11:09' },
        changed: NARROW_STATES.filter((name) => name.startsWith('reset')),
        look: '[&_[data-camera-reset]_button]:font-ui-strong',
      },
    ],
  },
};

export const rowsOf = (part: SketchPart, fresh: boolean) =>
  fresh ? part.rows.filter((row) => row.key !== 'current') : part.rows;

export const withSame = (part: SketchPart, same: RowKey[]): SketchPart => ({
  ...part,
  rows: part.rows.map((row) => (same.includes(row.key) ? { ...row, changed: [], look: '' } : row)),
});

export const isSame = (row: Row) => row.key !== 'current' && row.changed.length === 0;

export const sameLabel = (rows: Row[]) => `Unverändert: ${rows.map((row) => `Variante ${row.key}`).join(', ')}`;

export const isTransposed = (part: SketchPart, viewWidth: number) => part.width > viewWidth / 4;

const shot: Record<string, string> = {};

export const prepareShots = async (part: SketchPart) => {
  const renders = await Promise.all(part.states.map((state) => part.render(state)));
  part.states.forEach((state, index) => {
    shot[`${part.key}:${state}`] = renders[index]?.body ?? '';
  });
  return renders[0]?.styles ?? '';
};

const firstChanged = (row: Row) => (row.key === 'current' ? undefined : row.changed[0]);

const unchanged = (row: Row, state: string) => row.key !== 'current' && !row.changed.includes(state);

export const cell = (part: SketchPart, row: Row, state: string, place = '', pending = false) =>
  variantCell({
    state,
    width: part.width,
    shot: shot[`${part.key}:${state}`] ?? '',
    look: row.changed.includes(state) ? row.look : '',
    same: !pending && unchanged(row, state),
    first: !pending && state === firstChanged(row),
    place,
    sample: pending ? undefined : `${part.key} ${row.key} ${state}${isSame(row) ? ' unchanged' : ''}`,
  });

export const wrapStage = (part: SketchPart, row: Row, pending = false) =>
  html`<div class="grid min-w-0 grid-cols-[repeat(var(--sk-cols),var(--sk-frame))] gap-x-6 gap-y-space-3" data-sk-stage>
    ${part.states.map((state) => cell(part, row, state, '', pending)).join('')}
  </div>`;

export const wrapColumns = (part: SketchPart) =>
  Math.max(1, Math.min(4, part.states.length, Math.floor(1440 / part.width)));

export const takeButton = () => button.render({ label: 'Übernehmen', variant: 'outline', size: 'sm' });

export const takeAction = (take: string) => html`<span class="flex">${withAction(take, 'emit:merge')}</span>`;

export const comparingMark = html`<span class="text-ui-xs text-et-surface-muted whitespace-nowrap" data-sk-comparing
  >vergleicht …</span
>`;

export const rowHead = (row: Row, action: string, mark = '') =>
  html`<div class="flex min-w-0 flex-col gap-space-2 in-data-sk-head-hidden:invisible" data-sk-row-head>
    <div class="flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
      ${
        row.key === 'current'
          ? html`<span class="text-ui-sm font-ui-medium text-et-surface">Aktuell</span>`
          : html`<span class="font-code text-ui-sm text-et-surface">Variante ${row.key}</span>`
      }
      ${
        row.model
          ? html`<span
              class="flex items-center gap-space-1 text-ui-sm text-et-surface-muted"
              title="${row.model.id} · ${row.model.when}"
              >${agentLogo(row.model.agent, 'size-3 flex-none')}${row.model.short}</span
            >`
          : ''
      }
      ${mark}
    </div>
    <p class="m-0 text-(length:--sk-note) leading-[1.35] text-et-surface-muted wrap-anywhere" data-sk-note>
      ${row.note}
    </p>
    ${row.key === 'current' ? '' : action}
  </div>`;

export type Zoom = 'fit' | number;

const GAP = 24;
const MIN_TEXT = 12;
const NOTE_TEXT = 15;
const HEAD_WIDTH = 288;
const LABEL_TEXT = 13;
const MIN_LABEL = 9;
const FIT_PADDING = 16;

export const mountFit = (root: HTMLElement, zoom: Zoom, start = { x: 0, y: 0 }) => {
  const list = root.querySelector<HTMLElement>('[data-sk-rows]');
  const world = list?.querySelector<HTMLElement>('[data-sk-rows-world]');
  if (!list || !world) return () => undefined;
  const chip = [...root.querySelectorAll('[data-canvas-zoom]')].find((element) => !list.contains(element));
  const label = chip?.querySelector('[data-camera-reset] button') ?? null;
  const width = Number(world.dataset['w']);
  const columns = Number(world.dataset['cols']);
  let mode = zoom;
  let fitAt = 0;

  const noteAt = (scale: number) => {
    const floor = Math.max(MIN_TEXT, NOTE_TEXT * fitAt);
    return scale >= fitAt ? Math.max(MIN_TEXT, NOTE_TEXT * scale) : (floor * scale) / fitAt;
  };

  const apply = (scale: number) => {
    const note = noteAt(scale);
    const text = LABEL_TEXT * scale;
    world.style.setProperty('--sk-scale', `${scale}`);
    world.style.setProperty('--sk-frame', `${width * scale}px`);
    world.style.setProperty('--sk-cols', `${columns}`);
    world.style.setProperty('--sk-note', `${note}px`);
    world.style.setProperty('--sk-head', `${(HEAD_WIDTH * note) / NOTE_TEXT}px`);
    world.style.setProperty('--sk-label', `${text}px`);
    world.toggleAttribute('data-sk-labels-hidden', text < MIN_LABEL);
    world.toggleAttribute('data-sk-head-hidden', note < MIN_LABEL);
    world.querySelectorAll<HTMLElement>('[data-sk-pin]').forEach((pin) => (pin.hidden = note < MIN_LABEL));
    world.querySelectorAll<HTMLElement>('[data-sk-head-full]').forEach((head) => (head.hidden = note < MIN_LABEL));
    world.querySelectorAll<HTMLElement>('[data-sk-frame]').forEach((element) => {
      const inner = element.querySelector<HTMLElement>('[data-sk-fit-inner]');
      if (inner) element.style.height = `${inner.offsetHeight * scale}px`;
    });
  };

  const matrixFit = (matrix: HTMLElement) => {
    const first = matrix.querySelector<HTMLElement>('[data-sk-row]');
    const lead = first ? first.getBoundingClientRect().left - matrix.getBoundingClientRect().left : 0;
    return Math.min(1, (list.clientWidth - lead - (columns - 1) * GAP - FIT_PADDING) / (columns * width));
  };

  const gridFit = (scale: number) => {
    const stage = world.querySelector<HTMLElement>('[data-sk-stage]');
    const widthFit = stage ? (stage.clientWidth - (columns - 1) * GAP) / (columns * width) : 1;
    const sections = [...world.querySelectorAll<HTMLElement>('[data-sk-row]')].slice(0, 2);
    const first = sections[0];
    const last = sections.at(-1);
    if (!first || !last) return Math.min(1, widthFit);
    const lines = new Map<number, number>();
    sections.forEach((section) =>
      section.querySelectorAll<HTMLElement>('[data-sk-frame]').forEach((element) => {
        const box = element.getBoundingClientRect();
        const top = Math.round(box.top);
        lines.set(top, Math.max(lines.get(top) ?? 0, box.height));
      }),
    );
    const frames = [...lines.values()].reduce((sum, height) => sum + height, 0);
    const total = last.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
    const room = list.clientHeight - FIT_PADDING - (total - frames);
    const heightFit = frames > 0 && room > 0 ? (room * scale) / frames : Infinity;
    return Math.min(1, widthFit, heightFit);
  };

  const fitScale = () => {
    const matrix = world.querySelector<HTMLElement>('[data-sk-matrix]');
    let scale = 1;
    for (let pass = 0; pass < 6; pass++) {
      apply(scale);
      const next = matrix ? matrixFit(matrix) : gridFit(scale);
      if (Math.abs(next - scale) <= 0.002) break;
      scale = next;
    }
    return scale;
  };

  const fit = () => {
    fitAt = 0;
    fitAt = fitScale();
    const scale = mode === 'fit' ? fitAt : mode;
    apply(scale);
    if (label) label.textContent = `${Math.round(scale * 100)} %`;
  };

  const set = (next: Zoom) => () => {
    mode = next;
    fit();
  };
  const current = () => Number(world.style.getPropertyValue('--sk-scale')) || 1;
  chip?.querySelector('[data-camera-fit]')?.addEventListener('click', set('fit'));
  chip?.querySelector('[data-camera-reset]')?.addEventListener('click', set(1));
  chip?.querySelector('[data-camera-in]')?.addEventListener('click', () => set(current() * 1.5)());
  chip?.querySelector('[data-camera-out]')?.addEventListener('click', () => set(current() / 1.5)());

  const offset = { x: 0, y: 0 };
  const pan = (x: number, y: number) => {
    const roomX = Math.max(0, world.scrollWidth - list.clientWidth);
    const roomY = Math.max(0, world.offsetHeight - list.clientHeight);
    const inside = panInsideRoom({ x: -(offset.x + x), y: -(offset.y + y) }, { x: roomX, y: roomY });
    offset.x = -inside.x;
    offset.y = -inside.y;
    world.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
    world.style.setProperty('--sk-pan-x', `${offset.x}px`);
    world.toggleAttribute('data-sk-panned', offset.x > 0);
  };
  list.addEventListener('wheel', (event) => {
    event.preventDefault();
    pan(event.deltaX, event.deltaY);
  });
  list.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button, [role=button]')) return;
    let last = { x: event.clientX, y: event.clientY };
    const move = (next: PointerEvent) => {
      pan(last.x - next.clientX, last.y - next.clientY);
      last = { x: next.clientX, y: next.clientY };
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  });

  new ResizeObserver(fit).observe(list);
  fit();
  pan(-start.x, -start.y);
  return fit;
};
