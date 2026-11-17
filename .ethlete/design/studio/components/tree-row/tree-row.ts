import { definePart, drawing, html } from '@design-system';
import { type Props, othersGrid, row, states } from './shared/tree-row';
import styles from './tree-row.css?inline';

export type { Row } from './shared/tree-row';

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/tree-row/tree-row.component.ts',
  note: 'One mark family: every end mark is a 12px line icon with the same stroke, its detail in a tooltip. Interaction is a background fill: hover lays the raised surface under the row, selection an accent tint with accent text, selected and hovered stacks both, pressed lays a fill a step darker than hover (a selected row keeps its hover tint), and focus-visible draws an inset ring. The stack has no outer padding; the host sets it.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [280],
  states,
  grid: {
    columns: ['rest', 'hover', 'active', 'focus-visible'],
    rows: {
      leaf: { rest: 'leaf', hover: 'hover', active: 'active', 'focus-visible': 'focus-visible' },
      selected: {
        rest: 'selected',
        hover: 'selected-hover',
        active: 'selected-active',
        'focus-visible': 'selected-focus-visible',
      },
      ...othersGrid.rows,
    },
  },
  describe: {
    tree: 'A whole tree with groups, parts, leaves, a selected row, a hovered row and every end mark; check that the depths indent evenly and the marks line up at the right.',
    leaf: 'The button leaf at rest with its dot; check that the dot sits at the chevron position of its depth and no fill shows.',
    hover:
      'The button leaf hovered; check the faint raised fill under the whole row and that the text keeps its colour.',
    active: 'The button leaf pressed; check the stronger press fill under the row.',
    'focus-visible':
      'The button leaf focused by keyboard; check the focus ring around the row, not clipped by the tree edge.',
    selected: 'The button leaf selected; check the accent tint under the row and the accent text and dot.',
    'selected-hover':
      'The selected leaf hovered; check that the hover fill lies over the accent tint and the accent text stays.',
    'selected-active': 'The selected leaf pressed; check the press fill over the accent tint.',
    'selected-focus-visible': 'The selected leaf focused by keyboard; check the focus ring over the accent tint.',
    'group-closed': 'The closed Foundations group at depth 0; check the right chevron and the muted group label.',
    'group-closed-hover':
      'The closed group hovered; check the faint raised fill under the whole row and that the label keeps its colour.',
    'group-closed-active': 'The closed group pressed; check the stronger press fill under the row.',
    'group-closed-focus-visible':
      'The closed group focused by keyboard; check the focus ring around the row, not clipped by the tree edge.',
    'group-open': 'The open Components group at depth 0; check the down chevron and the muted group label.',
    'group-open-hover':
      'The open group hovered; check the faint raised fill under the whole row and that the label keeps its colour.',
    'group-open-active': 'The open group pressed; check the stronger press fill under the row.',
    'group-open-focus-visible':
      'The open group focused by keyboard; check the focus ring around the row, not clipped by the tree edge.',
    'part-closed':
      'The closed select part at depth 1; check the right chevron, one step indented, and the full text colour.',
    'part-closed-hover':
      'The closed part hovered; check the faint raised fill under the whole row and that the label keeps its colour.',
    'part-closed-active': 'The closed part pressed; check the stronger press fill under the row.',
    'part-closed-focus-visible':
      'The closed part focused by keyboard; check the focus ring around the row, not clipped by the tree edge.',
    'part-open': 'The open form-field part at depth 1; check the down chevron, one step indented.',
    'part-open-hover':
      'The open part hovered; check the faint raised fill under the whole row and that the label keeps its colour.',
    'part-open-active': 'The open part pressed; check the stronger press fill under the row.',
    'part-open-focus-visible':
      'The open part focused by keyboard; check the focus ring around the row, not clipped by the tree edge.',
    'leaf-flat': 'A leaf of a flat list at depth 0; check that its dot sits at the left edge without indentation.',
    'leaf-flat-hover':
      'The flat leaf hovered; check the faint raised fill under the whole row and that the label keeps its colour.',
    'leaf-flat-active': 'The flat leaf pressed; check the stronger press fill under the row.',
    'leaf-flat-focus-visible':
      'The flat leaf focused by keyboard; check the focus ring around the row, not clipped by the tree edge.',
    'mark-in-progress': 'A leaf with the in-progress mark; check the muted 12px pencil at the right end.',
    'mark-in-progress-hover':
      'The in-progress leaf hovered; check the faint raised fill under the whole row and that its marks keep their colour.',
    'mark-in-progress-active': 'The in-progress leaf pressed; check the stronger press fill under the row.',
    'mark-in-progress-focus-visible':
      'The in-progress leaf focused by keyboard; check the focus ring around the row and that its marks stay inside it.',
    'mark-ready': 'A leaf with the ready mark; check the 12px accent check at the right end.',
    'mark-ready-hover':
      'The ready leaf hovered; check the faint raised fill under the whole row and that its marks keep their colour.',
    'mark-ready-active': 'The ready leaf pressed; check the stronger press fill under the row.',
    'mark-ready-focus-visible':
      'The ready leaf focused by keyboard; check the focus ring around the row and that its marks stay inside it.',
    'mark-warning': 'A part with a render warning; check the 12px warning icon in the warning colour at the right end.',
    'mark-warning-hover':
      'The warning part hovered; check the faint raised fill under the whole row and that its marks keep their colour.',
    'mark-warning-active': 'The warning part pressed; check the stronger press fill under the row.',
    'mark-warning-focus-visible':
      'The warning part focused by keyboard; check the focus ring around the row and that its marks stay inside it.',
    'mark-comments': 'A leaf with open comments; check the muted 12px comment bubble at the right end.',
    'mark-comments-hover':
      'The leaf with comments hovered; check the faint raised fill under the whole row and that its marks keep their colour.',
    'mark-comments-active': 'The leaf with comments pressed; check the stronger press fill under the row.',
    'mark-comments-focus-visible':
      'The leaf with comments focused by keyboard; check the focus ring around the row and that its marks stay inside it.',
    'selected-marks':
      'A selected leaf with the ready and comment marks; check that both marks stay visible on the accent tint.',
    'selected-marks-hover':
      'The selected leaf with marks hovered; check the faint raised fill under the whole row and that its marks keep their colour.',
    'selected-marks-active': 'The selected leaf with marks pressed; check the stronger press fill under the row.',
    'selected-marks-focus-visible':
      'The selected leaf with marks focused by keyboard; check the focus ring around the row and that its marks stay inside it.',
    'mark-layer':
      'A leaf nested under a host of another layer; check the small muted Components tag right after the label, before the end marks.',
    'selected-layer':
      'The nested leaf of another layer selected; check that the layer tag takes the accent text on the accent tint.',
    inert: 'An inert leaf whose dot is hollow; check the outlined dot and that the label keeps its colour.',
    'inert-hover':
      'The inert leaf hovered; check the faint raised fill under the whole row and that the label keeps its colour.',
    'inert-active': 'The inert leaf pressed; check the stronger press fill under the row.',
    'inert-focus-visible':
      'The inert leaf focused by keyboard; check the focus ring around the row, not clipped by the tree edge.',
  },
  controls: { row: { kind: 'row', input: ['pointer', 'keyboard'] } },
  render: ({ rows }: Props) =>
    drawing({ body: html`<div class="flex flex-col gap-px">${rows.map(row).join('')}</div>`, styles }),
});
