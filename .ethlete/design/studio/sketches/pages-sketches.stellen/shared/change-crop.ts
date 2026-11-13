import { html, slot } from '@design-system';
import zoomChip from '@system/components/zoom-chip';
import { type Row } from '@shared/sketch-rows';

type Box = { x: number; y: number; width: number; height: number };

export type ChangeGroup = { states: string[]; box: Box; pixels: number; units: string };

export const SCREEN_WIDTH = 1440;
export const SCREEN_HEIGHT = 900;
const MARGIN = 24;
const CELL_WIDTH = 176;
const CELL_HEIGHT = 45;
const CELL_GAP = 23;

export const SCREEN_KEY = 'pages/sketches';

export const GROUPS: ChangeGroup[] = [
  {
    states: [
      'comparing-narrow',
      'narrow-part',
      'narrow-below-fit',
      'narrow-far-out',
      'unchanged-open',
      'all-unchanged',
      'withdrawn-hidden',
      'withdrawn-shown',
      'agent-round',
      'agent-variant',
      'agent-failed',
      'question-only',
    ],
    box: { x: 842, y: 371, width: 575, height: 45 },
    pixels: 1358,
    units: '3 Stellen',
  },
  {
    states: ['port-after-merge'],
    box: { x: 300, y: 92, width: 420, height: 24 },
    pixels: 2140,
    units: '1 Stelle',
  },
];

export const UNCHANGED_COUNT = 16;

export const SCREEN_ROWS: Row[] = [
  { key: 'current', note: 'Gemergter Stand', changed: [], look: '' },
  {
    key: 'a',
    note: 'Port nach dem Merge als Zeile unter dem Kopf; die Zellen der Probe tragen die Pillenform.',
    model: { short: 'Opus 5.5', id: 'claude-opus-5-5', agent: 'claude', when: '04.11. 09:12' },
    changed: GROUPS.flatMap((group) => group.states),
    look: '',
  },
];

export const cropOf = (box: Box): Box => {
  const x = Math.max(0, box.x - MARGIN);
  const y = Math.max(0, box.y - MARGIN);
  return {
    x,
    y,
    width: Math.min(SCREEN_WIDTH, box.x + box.width + MARGIN) - x,
    height: Math.min(SCREEN_HEIGHT, box.y + box.height + MARGIN) - y,
  };
};

const magnifyOf = (crop: Box) => SCREEN_WIDTH / crop.width;

export const reasonOf = (group: ChangeGroup) => `${group.pixels} px in ${group.units}`;

export const zoomTextOf = (crop: Box) => `${magnifyOf(crop).toFixed(1).replace('.', ',')}×`;

const CHIP_STATES = ['fit', 'fit-hover', 'fit-active', 'fit-focus-visible'] as const;

type ChipProps = Parameters<typeof zoomChip.render>[0];

const chipOf = async (name: string) => {
  const states = zoomChip.states as Record<string, ChipProps>;
  return (await zoomChip.render(states[name] as ChipProps)) as { body: string; styles: string };
};

const cellAt = (x: number, y: number, chip: string, round: boolean) =>
  html`<div
    class="absolute flex items-center justify-center shadow-[0_0_0_1px_var(--et-surface-border-solid)] ${
      round ? 'rounded-full **:data-canvas-zoom:rounded-full' : 'rounded-control-sm'
    }"
    style="left: ${x}px; top: ${y}px; width: ${CELL_WIDTH}px; height: ${CELL_HEIGHT}px"
  >
    ${chip}
  </div>`;

const rowAt = (y: number, label: string, note: string, chips: string[], round: boolean) =>
  html`<div class="absolute" style="left: 300px; top: ${y}px; width: 300px">
      <div class="font-code text-ui-sm text-et-surface">${label}</div>
      <p class="m-0 mt-space-1 text-ui-sm text-et-surface-muted">${note}</p>
    </div>
    ${chips.map((chip, index) => cellAt(643 + index * (CELL_WIDTH + CELL_GAP), y, chip, round && index > 0)).join('')}`;

export const screenOf = async (state: string, changed: boolean) => {
  const chips = await Promise.all(CHIP_STATES.map(chipOf));
  const bodies = chips.map((chip) => chip.body);
  const port = GROUPS[1]?.states.includes(state) ?? false;
  const cells = GROUPS[0]?.states.includes(state) ?? false;
  const body = html`<div
    class="relative overflow-hidden bg-et-surface-bg text-et-surface"
    style="width: ${SCREEN_WIDTH}px; height: ${SCREEN_HEIGHT}px"
    data-cc-screen="${state}"
    inert
    ${slot('screen')}
  >
    <div class="absolute inset-y-0 left-0 w-65 shadow-[1px_0_0_var(--et-surface-border-solid)]">
      <div class="flex flex-col gap-space-2 p-space-5 text-ui-sm text-et-surface-muted">
        <span class="text-et-surface">components</span><span>button</span><span>title-bar</span
        ><span class="text-et-surface">zoom-chip</span><span>tooltip</span>
      </div>
    </div>
    <div class="absolute flex items-center gap-space-3" style="left: 300px; top: 40px">
      <span class="text-ui-lg font-ui-strong">components/zoom-chip</span>
      <span class="text-ui-sm text-et-surface-muted">${state}</span>
    </div>
    ${
      port && changed
        ? html`<div class="absolute text-ui-sm text-et-surface" style="left: 300px; top: 92px">
            Übernommen: components/button · seit 1 Min
          </div>`
        : ''
    }
    ${rowAt(200, 'Aktuell', 'Gemergter Stand', bodies, false)}
    ${rowAt(371, 'Variante a', 'Chip als Pille, die Knöpfe rücken enger zusammen.', bodies, cells && changed)}
    ${rowAt(540, 'Variante b', 'Prozentzahl in Halbfett.', bodies, false)}
  </div>`;
  return { body, styles: chips[0]?.styles ?? '' };
};

const markOf = (box: Box) =>
  html`<span
    class="pointer-events-none absolute rounded-control-sm border-2 border-et-theme"
    style="left: ${box.x - 4}px; top: ${box.y - 4}px; width: ${box.width + 8}px; height: ${box.height + 8}px"
  ></span>`;

export const markedScreen = (screen: string, box: Box) =>
  html`<div class="relative" style="width: ${SCREEN_WIDTH}px; height: ${SCREEN_HEIGHT}px">
    ${screen}${markOf(box)}
  </div>`;

export const cropShot = (screen: string, crop: Box) => {
  const scale = magnifyOf(crop);
  return html`<div
    class="relative overflow-hidden"
    data-et-skip="CLIPPED"
    style="width: ${SCREEN_WIDTH}px; height: ${crop.height * scale}px"
  >
    <div
      class="origin-top-left"
      style="transform: scale(${scale}) translate(${-crop.x}px, ${-crop.y}px); width: ${SCREEN_WIDTH}px"
    >
      ${screen}
    </div>
  </div>`;
};
