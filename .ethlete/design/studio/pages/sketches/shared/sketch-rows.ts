import { html, slot } from '@design-system';
import button from '@system/components/button';
import titleBar from '@system/components/title-bar';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';

export type RowKey = 'current' | 'a' | 'b' | 'c';
export type ShownState = 'linux-close' | 'linux-close-update' | 'windows' | 'windows-update' | 'macos' | 'macos-update';

type Model = { short: string; id: string; agent: Agent; when: string };

export type Row = {
  key: RowKey;
  note: string;
  model?: Model;
  changed: ShownState[];
  look: string;
};

export const ROW_PART = { key: 'components/title-bar', width: 1440 };

export const SHOWN_STATES: ShownState[] = [
  'linux-close',
  'linux-close-update',
  'windows',
  'windows-update',
  'macos',
  'macos-update',
];

const OPUS: Omit<Model, 'when'> = { short: 'Opus 5.5', id: 'claude-opus-5-5', agent: 'claude' };
const SOL: Omit<Model, 'when'> = { short: 'GPT-6.1 Sol', id: 'gpt-6.1-sol', agent: 'codex' };

export const ROWS: Row[] = [
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
    changed: [...SHOWN_STATES],
    look: '[&_.st-title-bar]:h-10',
  },
  {
    key: 'c',
    note: 'Unter macOS rückt die Suche nach links an die Ampel, Linux und Windows bleiben gleich.',
    model: { ...OPUS, when: '02.11. 10:30' },
    changed: ['macos', 'macos-update'],
    look: '[&_.st-title-bar]:grid-cols-[auto_1fr_auto]',
  },
];

export const NEW_ROWS = ROWS.filter((row) => row.key !== 'current');

const shot: Partial<Record<ShownState, string>> = {};
let shotStyles = '';

export const prepareShots = async () => {
  const renders = await Promise.all(SHOWN_STATES.map((state) => titleBar.render(titleBar.states[state])));
  SHOWN_STATES.forEach((state, index) => {
    shot[state] = renders[index]?.body ?? '';
  });
  shotStyles = renders[0]?.styles ?? '';
  return shotStyles;
};

export const firstChanged = (row: Row): ShownState => row.changed[0] ?? SHOWN_STATES[0] ?? 'linux-close';

export const fitFrame = (row: Row, state: ShownState) => {
  const look = row.changed.includes(state) ? row.look : '';
  return html`<div class="sk-fit relative w-full overflow-hidden" data-w="${ROW_PART.width}" data-et-skip="CLIPPED">
    <div class="w-(--w) origin-top-left ${look}" data-sk-fit-inner style="--w: ${ROW_PART.width}px" ${slot('shot')}>
      ${shot[state] ?? ''}
    </div>
  </div>`;
};

const take = await button.render({ label: 'Übernehmen', variant: 'outline', size: 'sm' });
export const takeStyles = take.styles;

export const rowHead = (row: Row, action?: string) =>
  html`<div class="flex min-w-0 flex-col gap-space-2" data-sk-row-head>
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
    </div>
    <p class="m-0 text-ui-sm text-et-surface-muted">${row.note}</p>
    ${
      row.key === 'current'
        ? ''
        : (action ??
          html`<span class="flex">${take.body.replace(/<button\b/, '<button data-et-action="emit:merge"')}</span>`)
    }
  </div>`;

export type Zoom = 'fit' | number;

export const mountFit = (root: HTMLElement, zoom: Zoom) => {
  const list = root.querySelector<HTMLElement>('[data-sk-rows]');
  const chip = root.querySelector('[data-canvas-zoom]');
  const label = chip?.querySelector('[data-camera-reset] button') ?? null;
  if (!list) return () => undefined;
  let mode = zoom;

  const fit = () => {
    let shown: number | undefined;
    list.querySelectorAll<HTMLElement>('.sk-fit').forEach((frame) => {
      const inner = frame.querySelector<HTMLElement>('[data-sk-fit-inner]');
      const width = Number(frame.dataset['w']);
      if (!inner || !width || frame.offsetParent === null) return;
      frame.style.width = mode === 'fit' ? '' : `${width * mode}px`;
      const scale = mode === 'fit' ? Math.min(1, frame.clientWidth / width) : mode;
      shown ??= scale;
      inner.style.transform = `scale(${scale})`;
      frame.style.height = `${inner.offsetHeight * scale}px`;
    });
    if (label) label.textContent = `${Math.round((shown ?? 1) * 100)} %`;
  };

  const set = (next: Zoom) => () => {
    mode = next;
    fit();
  };
  const current = () => (mode === 'fit' ? 1 : mode);
  chip?.querySelector('[data-camera-fit]')?.addEventListener('click', set('fit'));
  chip?.querySelector('[data-camera-reset]')?.addEventListener('click', set(1));
  chip?.querySelector('[data-camera-in]')?.addEventListener('click', () => set(current() * 1.5)());
  chip?.querySelector('[data-camera-out]')?.addEventListener('click', () => set(current() / 1.5)());

  const world = list.querySelector<HTMLElement>('[data-sk-rows-world]');
  const offset = { x: 0, y: 0 };
  const pan = (x: number, y: number) => {
    if (!world) return;
    const roomX = Math.max(0, world.scrollWidth - list.clientWidth);
    const roomY = Math.max(0, world.offsetHeight - list.clientHeight);
    offset.x = Math.min(roomX, Math.max(0, offset.x + x));
    offset.y = Math.min(roomY, Math.max(0, offset.y + y));
    world.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
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
  return fit;
};
