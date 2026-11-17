import { html, ng } from '@design-system';

export type FrameMark = 'selected' | 'active' | 'failed' | 'loading';
export type GridHeads = 'open' | 'folded';

const BUTTON_IMPORTS = { imports: ['BUTTON_IMPORTS'] };

export const MARK_CLASS: Record<FrameMark, string> = {
  selected: 'outline-2 outline-solid outline-(--et-theme-color-primary-solid)',
  active: 'outline-2 outline-dashed outline-(--et-theme-color-primary-solid)',
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

const columnHead = ({ label, note }: Column) =>
  `<span class="text-[1.6rem] leading-[1.4] font-semibold text-et-surface">${label}<span class="block text-[0.8em] font-normal text-et-surface-muted">${note}</span></span>`;

const groupHead = async (round: RoundSample) =>
  html`<div class="flex items-center gap-space-2 text-(length:--text-sm) whitespace-nowrap">
    ${await ng(
      `<button et-button type="button" variant="transparent" color="surface" size="sm" aria-expanded="true" data-et-action="emit:columnToggle">${round.title}</button><button et-button type="button" variant="outline" color="surface" size="sm" [pressed]="false" data-et-action="emit:groupSwitch">Unveränderte Zustände zeigen</button>`,
      BUTTON_IMPORTS,
    )}
    <span class="min-w-0 truncate text-et-surface-muted">${round.note}</span>
  </div>`;

/** A round on the grid: its head with the fold button and the group switch, then one column per variant. */
export const openRound = async (round: Round) =>
  html`<div class="flex flex-col gap-space-5">
    ${await groupHead(round)}
    <div class="flex items-start gap-20">
      ${round.columns
        .map((column) => `<div class="flex flex-col gap-12">${columnHead(column)}${column.frame}</div>`)
        .join('')}
    </div>
  </div>`;

/** A folded round: its title as the unfold button and its note below, in place of its columns. */
export const foldedRound = async (round: RoundSample) =>
  html`<div class="flex w-60 flex-col gap-space-3 text-(length:--text-sm) leading-[1.4]">
    ${await ng(
      `<button et-button type="button" variant="outline" color="surface" size="sm" class="w-full whitespace-normal" aria-expanded="false" data-et-action="emit:columnToggle">${round.title}</button>`,
      BUTTON_IMPORTS,
    )}
    <p class="m-0 whitespace-pre-wrap text-et-surface-muted">${round.note}</p>
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
