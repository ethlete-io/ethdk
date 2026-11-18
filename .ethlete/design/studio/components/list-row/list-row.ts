import { control } from '@ethlete/components/design/control';
import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import styles from './list-row.css?inline';

type RowInteraction = 'hover' | 'active';

type Props = { content: string; selected?: boolean; interaction?: RowInteraction };

export const listRow = ({ content, selected = false, interaction }: Props) => {
  const markup = control(
    html`<li
      class="st-lrow px-space-2 py-space-1 rounded-control-sm cursor-pointer data-selected:bg-et-theme/20 hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15"
      data-et-action="emit:pick"
      tabindex="0"
      ${selected ? ' data-selected aria-current="true"' : ''}
    >
      ${content}
    </li>`,
    'row',
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const demo = html`<span class="flex flex-wrap items-baseline gap-space-2 gap-y-0 min-w-0 text-ui-sm whitespace-nowrap"
  ><span class="text-et-surface font-code">pages/system</span><span class="text-et-surface-muted">empty</span
  ><span class="basis-full text-et-surface-muted text-(length:--text-xs)">1 Instanz</span></span
>`;

const rows = interactionRows<Props, 'rest' | 'selected', RowInteraction>(
  { rest: { content: demo }, selected: { content: demo, selected: true } },
  { interactions: ['hover', 'active'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'A selectable row of a compact list, such as the changed places on the merge page: the host passes its content, selection lays an accent tint under it, and a click picks it. The root is an `li`; the host gives the list.',
  madeBy: ['claude-opus-5-5'],
  widths: [240],
  controls: { row: { kind: 'row', input: ['pointer'] } },
  states: rows.states,
  grid: rows.grid,
  instant: 'Selection switches at once when another row is picked.',
  frame: (body) =>
    html`<ul class="flex flex-col m-0 p-0 list-none">
      ${body}
    </ul>`,
  describe: {
    rest: 'A compact list row with pages/system, empty and 1 Instanz; check that the second line wraps under the name and no tint shows.',
    'rest-hover':
      'The row hovered; check the faint raised fill under the whole row and that the text keeps its colour.',
    'rest-active': 'The row pressed; check the stronger press fill under the row.',
    selected:
      'The same row selected; check the rounded accent tint under the whole row and that the muted text stays readable.',
    'selected-hover':
      'The selected row hovered; check that the hover fill lies over the accent tint and the text stays readable.',
    'selected-active': 'The selected row pressed; check the press fill over the accent tint.',
  },
  render: (props: Props) => drawing({ body: listRow(props), styles }),
});
