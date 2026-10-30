import { definePart, drawing, html, svgAsset } from '@design-system';
import chevronRight from '@assets/icons/chevron-right.svg?raw';
import chevronDown from '@assets/icons/chevron-down.svg?raw';
import arrowLeft from '@assets/icons/arrow-left.svg?raw';
import check from '@assets/icons/check.svg?raw';
import error from '@assets/icons/error.svg?raw';
import warning from '@assets/icons/warning.svg?raw';
import comment from '@assets/icons/comment.svg?raw';
import pencil from '@assets/icons/pencil.svg?raw';
import reply from '@assets/icons/reply.svg?raw';
import grid from '@assets/icons/grid.svg?raw';
import flow from '@assets/icons/flow.svg?raw';
import inbox from '@assets/icons/inbox.svg?raw';
import more from '@assets/icons/more.svg?raw';
import upDown from '@assets/icons/up-down.svg?raw';
import panel from '@assets/icons/panel.svg?raw';
import styles from './icons.css?inline';

export type IconName =
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-left'
  | 'check'
  | 'error'
  | 'warning'
  | 'comment'
  | 'pencil'
  | 'reply'
  | 'grid'
  | 'flow'
  | 'inbox'
  | 'more'
  | 'up-down'
  | 'panel';

const icons: Record<IconName, string> = {
  'chevron-right': chevronRight,
  'chevron-down': chevronDown,
  'arrow-left': arrowLeft,
  check,
  error,
  warning,
  comment,
  pencil,
  reply,
  grid,
  flow,
  inbox,
  more,
  'up-down': upDown,
  panel,
};

export const iconNames = Object.keys(icons) as IconName[];

/** An icon of the 16 px set as inline SVG in `currentColor`, 16 px by default; `cls` lets a host size or place it in its own CSS. */
export const icon = (name: IconName, { size = 16, cls = '' }: { size?: number; cls?: string } = {}) =>
  svgAsset(icons[name], { size, class: cls, attrs: { 'aria-hidden': 'true' } });

const sizes = [12, 14, 16, 20];

const catalogue = html`<div class="ic-root">
  <h2 class="ic-title">Icons: a 16 px grid with a 1.5 stroke, at each size the parts draw</h2>
  <div class="ic-grid">
    <span></span>
    ${sizes.map((size) => html`<span class="ic-label">${size} px</span>`).join('')}
    ${iconNames
      .map(
        (name) =>
          html`<span class="ic-name">${name}</span>${sizes
              .map((size) => html`<span class="ic-cell">${icon(name, { size })}</span>`)
              .join('')}`,
      )
      .join('')}
  </div>
</div>`;

const units = Array.from({ length: 15 }, (_, index) => index + 1);

const guide = (cls: string, paths: string) =>
  `<svg class="ic-guides ${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">${paths}</svg>`;

const pixelGrid = guide('ic-guides-pixel', units.map((unit) => `<path d="M${unit} 0V16M0 ${unit}H16"/>`).join(''));

const keyLines = guide('ic-guides-key', '<path d="M8 0V16M0 8H16"/><rect x="2" y="2" width="12" height="12"/>');

const construction = html`<div class="ic-root">
  <h2 class="ic-title">Icons on the 16 px grid: pixel lines, centre lines, and the 2 px padding</h2>
  <div class="ic-sheet">
    ${iconNames
      .map(
        (name) =>
          html`<div class="ic-plate">
            <span class="ic-frame">${pixelGrid}${icon(name, { size: 96, cls: 'ic-glyph' })}${keyLines}</span>
            <span class="ic-name">${name}</span>
          </div>`,
      )
      .join('')}
  </div>
</div>`;

type View = 'catalogue' | 'construction';

export default definePart<{ view: View }>({
  note: 'The icon set as one SVG asset per icon with one icon() export',
  madeBy: ['claude-opus-5-5'],
  states: { catalogue: { view: 'catalogue' }, construction: { view: 'construction' } },
  render: ({ view }) => drawing({ body: view === 'catalogue' ? catalogue : construction, styles }),
});
