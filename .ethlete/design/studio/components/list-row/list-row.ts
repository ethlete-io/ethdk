import { definePart, drawing, html } from '@design-system';

type Props = { content: string; selected?: boolean };

export const listRow = ({ content, selected = false }: Props) =>
  html`<li
    class="px-space-2 py-space-1 rounded-control-sm cursor-pointer data-selected:bg-et-theme/20"
    data-et-control="row"
    data-et-action="emit:pick"
    tabindex="0"
    ${selected ? ' data-selected' : ''}
  >
    ${content}
  </li>`;

const demo = html`<span class="flex flex-wrap items-baseline gap-space-2 gap-y-0 min-w-0 text-ui-sm whitespace-nowrap"
  ><span class="text-et-surface font-code">pages/system</span><span class="text-et-surface-muted">empty</span
  ><span class="basis-full text-et-surface-muted text-(length:--text-xs)">1 Instanz</span></span
>`;

export default definePart({
  note: 'A selectable row of a compact list, such as the changed places on the merge page: the host passes its content, selection lays an accent tint under it, and a click picks it. The root is an `li`; the host gives the list.',
  madeBy: ['claude-opus-5-5'],
  widths: [240],
  controls: { row: { kind: 'row', input: ['pointer'] } },
  states: {
    rest: { content: demo },
    selected: { content: demo, selected: true },
  },
  instant: 'Selection switches at once when another row is picked.',
  frame: (body) =>
    html`<ul class="flex flex-col m-0 p-0 list-none">
      ${body}
    </ul>`,
  render: (props: Props) => drawing({ body: listRow(props) }),
});
