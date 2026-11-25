import { html, slot } from '@design-system';
import {
  SAMPLE_CATEGORIES,
  SAMPLE_PLANT_ROWS,
  SAMPLE_POT_SIZES,
  samplePotTile,
} from '../../../../../../apps/ethlete-studio/src/app/design-harness/sample-product';
import { type Row } from './sketch-rows';

type Box = { x: number; y: number; width: number; height: number };

type VariantReason = { variant: string; pixels: number; units: string };

export type ChangeGroup = { states: string[]; box: Box; areas: Box[]; reasons: VariantReason[] };

export const SCREEN_WIDTH = 1440;
export const SCREEN_HEIGHT = 900;
const MARGIN = 24;
const CELL_WIDTH = 176;
const CELL_HEIGHT = 45;
const CELL_GAP = 23;

export const SCREEN_KEY = 'pages/plants';

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
      'agent-failed',
      'question-only',
    ],
    box: { x: 842, y: 371, width: 575, height: 45 },
    areas: [842, 1041, 1240].map((x) => ({ x, y: 371, width: 176, height: 45 })),
    reasons: [{ variant: 'Entwurf 1', pixels: 1358, units: '3 Stellen' }],
  },
  {
    states: ['port-after-merge'],
    box: { x: 300, y: 92, width: 420, height: 24 },
    areas: [{ x: 300, y: 92, width: 420, height: 24 }],
    reasons: [{ variant: 'Entwurf 1', pixels: 2140, units: '1 Stelle' }],
  },
];

export const UNCHANGED_COUNT = 16;

export const SCREEN_ROWS: Row[] = [
  { key: 'current', label: 'Stand', note: 'Gemergter Stand', changed: [], look: '' },
  {
    key: 'a',
    label: 'Entwurf 1',
    note: 'Versandhinweis als Zeile unter dem Kopf; die Topfgrößen tragen die Pillenform.',
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

const reasonOf = (reason: VariantReason) => `${reason.pixels} px in ${reason.units}`;

export const reasonLinesOf = (group: ChangeGroup) => {
  const texts = group.reasons.map(reasonOf);
  return new Set(texts).size <= 1
    ? texts.slice(0, 1)
    : group.reasons.map((reason, index) => `${reason.variant}: ${texts[index]}`);
};

export const zoomTextOf = (crop: Box) => `${magnifyOf(crop).toFixed(1).replace('.', ',')}×`;

const cellAt = (x: number, y: number, tile: string, round: boolean) =>
  html`<div
    class="absolute flex items-center justify-center shadow-[0_0_0_1px_var(--et-surface-border-solid)] ${
      round ? 'rounded-full' : 'rounded-control-sm'
    }"
    style="left: ${x}px; top: ${y}px; width: ${CELL_WIDTH}px; height: ${CELL_HEIGHT}px"
  >
    ${tile}
  </div>`;

const rowAt = (y: number, label: string, note: string, tiles: string[], round: boolean) =>
  html`<div class="absolute" style="left: 300px; top: ${y}px; width: 300px">
      <div class="text-ui-sm font-ui-medium text-et-surface">${label}</div>
      <p class="m-0 mt-space-1 text-ui-sm text-et-surface-muted">${note}</p>
    </div>
    ${tiles.map((tile, index) => cellAt(643 + index * (CELL_WIDTH + CELL_GAP), y, tile, round && index > 0)).join('')}`;

const ROW_TOPS = [200, 371, 540];

export const screenOf = (state: string, changed: boolean) => {
  const tiles = SAMPLE_POT_SIZES.map(({ size, price }) => samplePotTile(size, price));
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
        ${SAMPLE_CATEGORIES.map((name, index) =>
          index === 0 ? html`<span class="text-et-surface">${name}</span>` : html`<span>${name}</span>`,
        ).join('')}
      </div>
    </div>
    <div class="absolute flex items-center gap-space-3" style="left: 300px; top: 40px">
      <span class="text-ui-lg font-ui-strong">Topfgrößen</span>
      <span class="text-ui-sm text-et-surface-muted">${state}</span>
    </div>
    ${
      port && changed
        ? html`<div class="absolute text-ui-sm text-et-surface" style="left: 300px; top: 92px">
            Versandkostenfrei ab 50 € · Lieferung morgen
          </div>`
        : ''
    }
    ${SAMPLE_PLANT_ROWS.map((plant, index) =>
      rowAt(ROW_TOPS[index] ?? 0, plant.name, plant.note, tiles, index === 1 && cells && changed),
    ).join('')}
  </div>`;
  return { body, styles: '' };
};

const markOf = (box: Box) =>
  html`<span
    class="pointer-events-none absolute rounded-control-sm border-2 border-et-theme"
    style="left: ${box.x - 4}px; top: ${box.y - 4}px; width: ${box.width + 8}px; height: ${box.height + 8}px"
  ></span>`;

export const markedScreen = (screen: string, areas: Box[]) =>
  html`<div class="relative" style="width: ${SCREEN_WIDTH}px; height: ${SCREEN_HEIGHT}px">
    ${screen}${areas.map(markOf).join('')}
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
