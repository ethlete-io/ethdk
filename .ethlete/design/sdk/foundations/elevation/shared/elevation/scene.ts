import { selectOption, selectPanel, selectStyles } from '@ethlete/components/design/select';
import { drawing, html } from '@design-system';
import sceneStyles from './scene.css?inline';

export type ElevationProps = { scene: 'overview' | 'stacked' };

/** The variant's class for each elevated thing. */
type ElevationEdges = { card: string; panel: string; pane: string };

const OPTIONS = [
  { value: 'drafts', label: 'Drafts' },
  { value: 'review', label: 'In review' },
  { value: 'merged', label: 'Merged' },
  { value: 'archived', label: 'Archived' },
];

const pane = (id: string, edge: string) =>
  selectPanel({
    id,
    color: 'brand',
    content: OPTIONS.map((option) =>
      selectOption(option, {
        id: `${id}-${option.value}`,
        selected: option.value === 'review',
        active: option.value === 'merged' ? 'keyboard' : undefined,
      }),
    ).join(''),
  }).replace(
    '<et-select-panel class="',
    `<et-select-panel data-et-surface-fill class="sdk-elevation-pane-panel ${edge} `,
  );

const card = (edge: string) =>
  html`<article class="sdk-elevation-card ${edge} et-surface--inherited" data-et-surface-fill>
    <span class="sdk-elevation-label">Card</span>
    <strong>Season 2026</strong>
    <span class="sdk-elevation-muted">12 matches, 3 open</span>
  </article>`;

const panel = (edge: string) =>
  html`<section class="sdk-elevation-panel ${edge} et-surface--inherited" data-et-surface-fill>
    <span class="sdk-elevation-label">Panel</span>
    <strong>Edit match</strong>
    <span class="sdk-elevation-muted">Kick-off, venue and referee</span>
    <div class="sdk-elevation-line"></div>
    <div class="sdk-elevation-line sdk-elevation-line--short"></div>
  </section>`;

const overview = (edges: ElevationEdges) =>
  html`<div class="sdk-elevation-row">
    ${card(edges.card)} ${panel(edges.panel)}
    <div class="sdk-elevation-pane">
      <span class="sdk-elevation-label">Overlay pane</span>
      ${pane('overview', edges.pane)}
    </div>
  </div>`;

const stacked = (edges: ElevationEdges) =>
  html`<div class="sdk-elevation-stack">
    ${panel(edges.panel)}
    <div class="sdk-elevation-pane sdk-elevation-pane--over">${pane('stacked', edges.pane)}</div>
  </div>`;

/** Draws the elevated things of one scene on the base surface, each with its class from `edges`. */
export const elevationScene = ({ scene }: ElevationProps, edges: ElevationEdges, styles: string) =>
  drawing({
    body: html`<div class="sdk-elevation">${scene === 'overview' ? overview(edges) : stacked(edges)}</div>`,
    styles: [selectStyles, sceneStyles, styles].join('\n'),
  });

export const ELEVATION_STATES = {
  overview: { scene: 'overview' },
  stacked: { scene: 'stacked' },
} satisfies Record<string, ElevationProps>;
