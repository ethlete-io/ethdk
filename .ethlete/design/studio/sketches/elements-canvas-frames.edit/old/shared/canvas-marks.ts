import { html, ng } from '@design-system';

export type FrameMark = 'selected' | 'active' | 'failed' | 'loading';
export type GridHeads = 'open' | 'folded';

const BUTTON_IMPORTS = { imports: ['BUTTON_IMPORTS'] };

export const MARK_CLASS: Record<FrameMark, string> = {
  selected: 'after:outline-2 after:outline-solid after:outline-(--et-theme-color-primary-solid)',
  active: 'after:outline-2 after:outline-dashed after:outline-(--et-theme-color-primary-solid)',
  failed: '',
  loading: '',
};

/** The click a frame answers in each mark: the first selects it, a click on the selected frame (the double click) makes it live. */
export const MARK_ACTION: Record<FrameMark | 'rest', string> = {
  rest: 'selected',
  selected: 'active',
  active: '',
  failed: 'selected',
  loading: '',
};

export const liveBadge = `<span class="shrink-0 rounded-sm bg-(--et-theme-color-primary-solid) px-[0.4em] text-(--et-theme-color-on-primary)" data-live-badge>Live · Esc</span>`;

export const failureBanner = async (reason: string) =>
  html`<div
    class="absolute top-space-2 right-space-2 left-space-2 flex items-center gap-space-2 rounded-md border border-solid border-(--et-theme-color-primary-solid) bg-et-surface-bg p-space-2 text-(length:--text-xs) text-(--et-theme-color-primary-solid) shadow-md"
    data-et-semantic-color="error"
    role="alert"
  >
    <span class="min-w-0 flex-1">Laden fehlgeschlagen. ${reason}</span>
    ${await ng(
      '<button et-button type="button" variant="outline" size="xs" data-et-action="emit:reload">Neu laden</button>',
      BUTTON_IMPORTS,
    )}
  </div>`;

type Column = { label: string; note: string; frame: string };
type Round = { title: string; note: string; columns: Column[] };
export type RoundSample = { title: string; note: string; columns: Omit<Column, 'frame'>[] };

const LABEL_ZOOM = 'zoom: var(--st-canvas-label-scale, 1)';

const columnHead = ({ label, note }: Column) =>
  `<span style="${LABEL_ZOOM}" class="text-[1.6rem] leading-[1.4] font-semibold text-et-surface">${label}<span class="block text-[0.8em] font-normal text-et-surface-muted">${note}</span></span>`;

const groupHead = async (round: RoundSample) =>
  html`<div class="flex items-center gap-space-2 text-(length:--text-sm) whitespace-nowrap" style="${LABEL_ZOOM}">
    ${await ng(
      `<button et-button type="button" variant="transparent" color="surface" size="sm" aria-expanded="true" data-et-action="emit:columnToggle">${round.title}</button><button et-button type="button" variant="outline" color="surface" size="sm" [pressed]="false" data-et-action="emit:groupSwitch">Unveränderte Zustände zeigen</button>`,
      BUTTON_IMPORTS,
    )}
    <span class="min-w-0 truncate text-et-surface-muted">${round.note}</span>
  </div>`;

/** Rounded to 4 canvas px, so frames sit on whole screen pixels at 25 % steps; the harness camera rounds the same room. */
const HEADS_ROOM = 'round(calc(6.8rem + 6.782rem * var(--st-canvas-label-scale, 1)), 4px)';

const GROUP_HEAD_GAP = 'calc(6.8rem + 4.032rem * var(--st-canvas-label-scale, 1))';

/** A round on the grid: its head with the fold button and the group switch, then one column per variant; the heads keep their screen size at any zoom and hang from the frame bodies. */
export const openRound = async (round: Round) =>
  html`<div class="relative flex items-start gap-20" style="margin-top: ${HEADS_ROOM}">
    <div class="absolute left-0 w-max min-w-full -translate-y-full" style="top: calc(-1 * ${GROUP_HEAD_GAP})">
      ${await groupHead(round)}
    </div>
    ${round.columns
      .map(
        (column) =>
          `<div class="relative"><div class="absolute bottom-full left-0 mb-12 w-max">${columnHead(column)}</div>${column.frame}</div>`,
      )
      .join('')}
  </div>`;

/** A folded round: its title as the unfold button and its note below, in place of its columns, 240 px of the canvas wide. */
export const foldedRound = async (round: RoundSample) =>
  html`<div class="relative w-[24rem] shrink-0" style="margin-top: ${HEADS_ROOM}">
    <div class="absolute inset-x-0" style="top: calc(-1 * ${GROUP_HEAD_GAP})">
      <div
        class="flex flex-col gap-space-3 text-(length:--text-sm) leading-[1.4]"
        style="${LABEL_ZOOM}; width: calc(24rem / var(--st-canvas-label-scale, 1))"
      >
        <div class="flex h-0 flex-col justify-end">
          ${await ng(
            `<button et-button type="button" variant="outline" color="surface" size="sm" class="w-full whitespace-normal" aria-expanded="false" data-et-action="emit:columnToggle">${round.title}</button>`,
            BUTTON_IMPORTS,
          )}
        </div>
        <p class="m-0 line-clamp-12 whitespace-pre-wrap text-et-surface-muted">${round.note}</p>
      </div>
    </div>
  </div>`;

export const ROUNDS: Record<'first' | 'second', RoundSample> = {
  first: {
    title: 'Runde 1 · Fenstertasten',
    note: 'Kachel oder runde Taste unter Windows',
    columns: [
      { label: 'a', note: 'Caption-Form im SDK' },
      { label: 'b', note: 'Nur in Studio' },
    ],
  },
  second: {
    title: 'Runde 2 · Kombination',
    note: 'Kachel aus a, Fokus aus b',
    columns: [{ label: 'c', note: 'Kombination' }],
  },
};

export const FAILURE_REASON = 'Der Design-Server antwortet nicht.';
