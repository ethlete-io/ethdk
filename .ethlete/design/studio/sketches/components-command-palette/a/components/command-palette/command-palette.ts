import { definePart, drawing, html, ng } from '@design-system';
import { icon, type IconName } from '@system/foundations/icons';
import titleBar from '@system/components/title-bar';

type State = 'start' | 'empty' | 'results' | 'none';
type Props = { state: State };

type Item = { icon: IconName; label: string; hint: string; group: string };

const RECENT: Item[] = [
  { icon: 'search', label: 'Title bar', hint: 'Part', group: 'Zuletzt geöffnet' },
  { icon: 'search', label: 'Skizzen', hint: 'Seite', group: 'Zuletzt geöffnet' },
  { icon: 'search', label: 'update-dialog', hint: 'Part', group: 'Zuletzt geöffnet' },
];

const RESULTS: Item[] = [
  { icon: 'search', label: 'Title bar', hint: 'Part', group: 'Parts' },
  { icon: 'search', label: 'Title search', hint: 'Part', group: 'Parts' },
  { icon: 'search', label: 'Skizzen', hint: 'Seite', group: 'Seiten' },
  { icon: 'search', label: 'Titel-Skizze neu zeichnen', hint: 'Befehl', group: 'Befehle' },
];

const QUERY = 'tit';
const SELECTED = 1;

const itemsOf = (state: State) => (state === 'empty' ? RECENT : state === 'results' ? RESULTS : []);

const start = `<div class="flex flex-col items-center gap-space-2 px-space-3 py-space-6 text-ui-sm text-et-surface-muted"><span>Noch nichts zuletzt geöffnet. Tippe einen Namen oder Befehl.</span><span class="flex items-center gap-space-1 text-(length:--text-xs)"><et-kbd class="[--et-kbd-color:currentColor]" keys="mod+k" platform="other" /> öffnet die Suche von überall.</span></div>`;

const row = (item: Item, selected: boolean) =>
  `<div class="flex items-center gap-space-2 rounded-control-sm px-space-2 py-space-1 text-ui-sm ${selected ? 'bg-et-theme/20 text-et-surface' : 'text-et-surface'}" data-et-control="row" ${selected ? 'data-selected' : ''}>
    <span class="text-et-surface-muted">${icon(item.icon, { size: 14 })}</span>
    <span class="min-w-0 flex-1 truncate">${item.label}</span>
    <span class="text-et-surface-muted text-(length:--text-xs)">${item.hint}</span>
  </div>`;

const field = (state: State) =>
  `<div class="flex items-center gap-space-2 border-b border-et-surface-border px-space-3 py-space-2 text-ui-sm">
    <span class="text-et-surface-muted">${icon('search', { size: 14 })}</span>
    ${state === 'empty' || state === 'start' ? '<span class="flex-1 text-et-surface-muted">Parts, Seiten, Skizzen und Befehle suchen</span>' : `<span class="flex-1 text-et-surface">${state === 'none' ? 'xyz' : QUERY}<span class="inline-block h-4 w-px translate-y-0.5 bg-et-surface"></span></span>`}
    <et-kbd keys="esc" />
  </div>`;

const empty = `<div class="flex flex-col items-center gap-space-1 px-space-3 py-space-6 text-ui-sm"><span class="text-et-surface font-ui-strong">Nichts gefunden</span><span class="text-et-surface-muted">Für „${'xyz'}“ gibt es keinen Part, keine Seite und keine Skizze.</span></div>`;

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

const body = (state: State) => {
  const items = itemsOf(state);
  let n = -1;
  const list =
    state === 'none'
      ? empty
      : state === 'start'
        ? start
        : groups(items)
            .map(
              (g) =>
                `<div class="flex flex-col gap-0.5 p-space-1"><div class="px-space-2 pt-space-1 text-et-surface-muted text-(length:--text-xs)">${g}</div>${items
                  .filter((i) => i.group === g)
                  .map((i) => row(i, state === 'results' && ++n === SELECTED))
                  .join('')}</div>`,
            )
            .join('');
  return `<div class="absolute top-16 left-1/2 w-3xl -translate-x-1/2 overflow-hidden rounded-control-lg bg-et-surface-bg shadow-lg" data-et-auto-surface role="dialog" aria-modal="true" aria-label="Befehlsrahmen">${field(state)}<div class="max-h-64 overflow-auto">${list}</div><div class="flex gap-space-3 border-t border-et-surface-border px-space-3 py-space-2 text-et-surface-muted text-(length:--text-xs)"><span>↑↓ wählen</span><span>↵ öffnen</span><span class="flex-1"></span><span>Esc schließen</span></div></div>`;
};

export default definePart({
  note: 'Befehlsrahmen als zentriertes modales Fenster mit Scrim: breiter als das Titelfeld, Treffer nach Gruppen (Parts, Seiten, Skizzen, Befehle) mit Gruppenkopf, unten eine Tastenleiste. Ohne Eingabe und ohne zuletzt Geöffnetes steht ein gedämpfter Hinweis, was man suchen kann, und dass Ctrl K die Suche überall öffnet.',
  madeBy: ['claude-sonnet-5-5'],
  widths: [1440],
  controls: { row: { kind: 'row', input: ['pointer', 'keyboard'] } },
  states: {
    start: { state: 'start' },
    empty: { state: 'empty' },
    results: { state: 'results' },
    none: { state: 'none' },
  } satisfies Record<string, Props>,
  render: async (props: Props) => {
    const w = await window(await ng(body(props.state), { imports: ['KBD_IMPORTS'] }), true);
    return drawing({ body: w.body, styles: w.styles });
  },
});
