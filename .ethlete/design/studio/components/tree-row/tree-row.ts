import { definePart, drawing, html } from '@design-system';
import { type Props, row, states } from './shared/tree-row';
import styles from './tree-row.css?inline';

export type { Row } from './shared/tree-row';

export default definePart({
  note: 'One mark family: every end mark is a 12px line icon with the same stroke, its detail in a tooltip. Interaction is a background fill: hover lays the raised surface under the row, selection an accent tint with accent text, selected and hovered stacks both, pressed lays a fill a step darker than hover (a selected row keeps its hover tint), and focus-visible draws an inset ring. The stack has no outer padding; the host sets it.',
  madeBy: ['claude-opus-5-5'],
  widths: [280],
  states,
  render: ({ rows }: Props) =>
    drawing({ body: html`<div class="st-trow-stack">${rows.map(row).join('')}</div>`, styles }),
});
