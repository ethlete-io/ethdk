import { control } from '@ethlete/components/design/control';
import { definePart, drawing, forceInteraction, html, interactionRows, ng } from '@design-system';
import { icon } from '@system/foundations/icons';
import titleBar from '@system/components/title-bar';
import styles from './command-palette.css?inline';

type RowInteraction = 'hover' | 'active' | 'focus-visible';

type Kind = 'part' | 'page' | 'sketch' | 'command';
type Entry = { kind: Kind; key: string; label: string };

type Props = { entries: Entry[]; recents: Entry[]; query?: string; interaction?: RowInteraction };

const GROUPS: Record<Kind, string> = { part: 'Parts', page: 'Seiten', sketch: 'Skizzen', command: 'Befehle' };
const HINTS: Record<Kind, string> = { part: 'Part', page: 'Seite', sketch: 'Skizze', command: 'Befehl' };
const RECENT_GROUP = 'Zuletzt geöffnet';

const TITLE_BAR: Entry = { kind: 'part', key: 'components/title-bar', label: 'Title bar' };
const SKIZZEN: Entry = { kind: 'page', key: 'pages/sketches', label: 'Skizzen' };
const UPDATE_DIALOG: Entry = { kind: 'part', key: 'components/update-dialog', label: 'update-dialog' };

const ENTRIES: Entry[] = [
  TITLE_BAR,
  { kind: 'part', key: 'components/title-search', label: 'Title search' },
  UPDATE_DIALOG,
  SKIZZEN,
  { kind: 'page', key: 'pages/title', label: 'Titelseite' },
  { kind: 'command', key: 'redraw-title-sketch', label: 'Titel-Skizze neu zeichnen' },
];

const RECENT: Entry[] = [TITLE_BAR, SKIZZEN, UPDATE_DIALOG];

const matches = (entry: Entry, query: string) => {
  const label = entry.label.toLowerCase();
  let at = 0;

  for (const char of query.trim().toLowerCase()) {
    at = label.indexOf(char, at) + 1;

    if (at === 0) return false;
  }

  return true;
};

type Item = { label: string; hint: string; group: string };

const itemsOf = ({ entries, recents, query = '' }: Props): Item[] =>
  query.trim() === ''
    ? recents.map((entry) => ({ label: entry.label, hint: HINTS[entry.kind], group: RECENT_GROUP }))
    : (['part', 'page', 'sketch', 'command'] as const).flatMap((kind) =>
        entries
          .filter((entry) => entry.kind === kind && matches(entry, query))
          .map((entry) => ({ label: entry.label, hint: HINTS[entry.kind], group: GROUPS[kind] })),
      );

const start = `<div class="flex flex-col items-center gap-space-2 px-space-3 py-space-6 text-ui-sm text-et-surface-muted"><span>Noch nichts zuletzt geöffnet. Tippe einen Namen oder Befehl.</span><span class="flex items-center gap-space-1 text-(length:--text-xs)"><et-kbd class="[--et-kbd-color:currentColor]" keys="mod+k" platform="other" /> öffnet die Suche von überall.</span></div>`;

const row = (item: Item, selected: boolean, interaction?: RowInteraction) => {
  const markup = control(
    `<div class="st-cprow flex items-center gap-space-2 rounded-control-sm px-space-2 py-space-1 text-ui-sm outline-none text-et-surface ${selected ? 'bg-et-theme/20' : ''} hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15" ${selected ? 'data-selected aria-selected="true"' : ''}>
    <span class="text-et-surface-muted">${icon('search', { size: 14 })}</span>
    <span class="min-w-0 flex-1 truncate">${item.label}</span>
    <span class="text-et-surface-muted text-(length:--text-xs)">${item.hint}</span>
  </div>`,
    'row',
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const field = (query: string) =>
  `<div class="flex items-center gap-space-2 border-b border-et-surface-border px-space-3 py-space-2 text-ui-sm">
    <span class="text-et-surface-muted">${icon('search', { size: 14 })}</span>
    ${query.trim() === '' ? '<span class="flex-1 text-et-surface-muted">Parts, Seiten, Skizzen und Befehle suchen</span>' : `<span class="flex-1 text-et-surface">${query}<span class="inline-block h-4 w-px translate-y-0.5 bg-et-surface"></span></span>`}
    <et-kbd keys="esc" />
  </div>`;

const empty = (query: string) =>
  `<div class="flex flex-col items-center gap-space-1 px-space-3 py-space-6 text-ui-sm"><span class="text-et-surface font-ui-strong">Nichts gefunden</span><span class="text-et-surface-muted">Für „${query}“ gibt es keinen Part, keine Seite und keine Skizze.</span></div>`;

const window = async (overlay: string, scrim: boolean) => {
  const bar = await titleBar.render({
    os: 'linux',
    left: [],
    right: ['minimize', 'maximize', 'close'],
    update: false,
    product: 'studio',
    part: 'Title bar',
  });
  return {
    body: html`<div class="relative flex h-100 w-360 flex-col overflow-hidden bg-et-surface-bg" data-et-surface>
      ${bar.body}
      <div class="flex-1 border-t border-et-surface-border"></div>
      ${scrim ? '<div class="absolute inset-x-0 top-10 bottom-0 bg-et-surface-bg/60"></div>' : ''} ${overlay}
    </div>`,
    styles: bar.styles,
  };
};

const groups = (items: Item[]) => [...new Set(items.map((i) => i.group))];

const body = (props: Props) => {
  const { recents, interaction, query = '' } = props;
  const items = itemsOf(props);
  const searching = query.trim() !== '';
  let n = -1;
  const list =
    searching && items.length === 0
      ? empty(query)
      : !searching && recents.length === 0
        ? start
        : groups(items)
            .map(
              (g) =>
                `<div class="flex flex-col gap-0.5 p-space-1"><div class="px-space-2 pt-space-1 text-et-surface-muted text-(length:--text-xs)">${g}</div>${items
                  .filter((i) => i.group === g)
                  .map((i) => {
                    n++;
                    return row(i, searching && n === 0, searching && n === 0 ? interaction : undefined);
                  })
                  .join('')}</div>`,
            )
            .join('');
  return `<div class="absolute top-16 left-1/2 w-3xl -translate-x-1/2 overflow-hidden rounded-control-lg bg-et-surface-bg shadow-lg" data-et-auto-surface role="dialog" aria-modal="true" aria-label="Befehlsrahmen">${field(query)}<div class="max-h-64 overflow-auto">${list}</div><div class="flex gap-space-3 border-t border-et-surface-border px-space-3 py-space-2 text-et-surface-muted text-(length:--text-xs)"><span>↑↓ wählen</span><span>↵ öffnen</span><span class="flex-1"></span><span>Esc schließen</span></div></div>`;
};

const FOUND = { entries: ENTRIES, recents: [], query: 'tit' } satisfies Props;

const rows = interactionRows<Props, 'results', RowInteraction>(
  { results: FOUND },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/components/command-palette/command-palette.component.ts',
  note: 'Befehlsrahmen als zentriertes modales Fenster mit Scrim: breiter als das Titelfeld, Treffer nach Gruppen (Parts, Seiten, Skizzen, Befehle) mit Gruppenkopf, unten eine Tastenleiste. Ohne Eingabe und ohne zuletzt Geöffnetes steht ein gedämpfter Hinweis, was man suchen kann, und dass Ctrl K die Suche überall öffnet.',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5', 'design check'],
  widths: [1440],
  controls: { row: { kind: 'row', input: ['pointer', 'keyboard'] } },
  states: {
    start: { entries: ENTRIES, recents: [] },
    empty: { entries: ENTRIES, recents: RECENT },
    ...rows.states,
    none: { entries: ENTRIES, recents: [], query: 'xyz' },
  } satisfies Record<string, Props>,
  grid: rows.grid,
  describe: {
    start:
      'The palette with no recent items; check the placeholder in the field and the centred Noch nichts zuletzt geöffnet hint with its keys.',
    empty:
      'The palette before typing; check the placeholder and the Zuletzt geöffnet group with its three rows and their kind hints.',
    results:
      'Results for tit grouped into Parts, Seiten and Befehle; check each group heading and that only the first row shows the selected tint.',
    'results-hover': 'The selected result hovered; check that the hover fill lies over the accent tint.',
    'results-active': 'The selected result pressed; check the press fill over the accent tint.',
    'results-focus-visible':
      'The selected result focused by keyboard; check the inset focus ring over the accent tint.',
    none: 'A query without a match; check the typed xyz with its caret and the centred Nichts gefunden with its explanation line.',
  },
  render: async (props: Props) => {
    const w = await window(await ng(body(props), { imports: ['KBD_IMPORTS'] }), true);
    return drawing({ body: w.body, styles: `${w.styles}${styles}` });
  },
});
