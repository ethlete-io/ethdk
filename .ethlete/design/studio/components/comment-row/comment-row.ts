import { control } from '@ethlete/components/design/control';
import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';
import { icon } from '@system/foundations/icons';
import styles from './comment-row.css?inline';

export type Thread = {
  author: string;
  initials: string;
  agent?: Agent;
  when: string;
  part: string;
  state: string;
  text: string;
  replies: number;
  unread?: boolean;
  resolved?: boolean;
};

type RowInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { thread: Thread; selected?: boolean; interaction?: RowInteraction };

const replyIcon = icon('reply', { size: 14, cls: 'flex-none' });
const checkIcon = icon('check', { size: 14, cls: 'flex-none' });

const countClass = 'flex items-center gap-0.5 text-et-surface-muted';

export const commentRowStyles = styles;

export const commentRow = ({ thread: c, selected = false, interaction }: Props) => {
  const strong = c.resolved ? 'text-et-surface-muted' : 'text-et-surface';

  const markup = control(
    html`<div
      class="st-crow flex gap-space-2 p-space-2 rounded-control-md cursor-pointer outline-none ${selected ? 'bg-et-theme/20' : ''} hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15"
      data-et-action="emit:pick"
      data-et-surface-interactive
      role="button"
      tabindex="0"
      aria-pressed="${selected}"
    >
      <span
        class="st-crow-avatar flex flex-none items-center justify-center size-5 bg-et-surface-bg text-et-surface text-(length:--text-xs) font-ui-strong"
        data-et-auto-surface
        >${c.agent ? agentLogo(c.agent, 'size-3') : c.initials}</span
      >
      <div class="flex flex-1 flex-col gap-0.5 min-w-0">
        <div class="flex items-center gap-space-1 text-ui-xs whitespace-nowrap">
          <span class="${strong} font-ui-medium">${c.author}</span>
          <span class="flex-1 text-et-surface-muted">${c.when}</span>
          ${c.unread ? '<span class="st-crow-unread size-1.5 bg-et-theme"></span>' : ''}
        </div>
        <p class="m-0 line-clamp-2 ${strong} text-ui-sm">${c.text}</p>
        <div class="flex items-center gap-space-1 text-ui-xs whitespace-nowrap">
          <span
            class="flex-1 min-w-0 overflow-hidden text-ellipsis ${selected ? 'text-et-theme-ink' : 'text-et-surface-muted'} font-code"
            >${c.part} › ${c.state}</span
          >
          ${c.resolved ? `<span class="${countClass}">${checkIcon}</span>` : c.replies > 0 ? `<span class="${countClass}">${replyIcon}${c.replies}</span>` : ''}
        </div>
      </div>
    </div>`,
    'row',
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const person: Thread = {
  author: 'human',
  initials: 'H',
  when: 'vor 1 Std',
  part: 'button',
  state: 'tonal · rest',
  text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.',
  replies: 2,
};

const agent: Thread = {
  author: 'Claude',
  initials: 'C',
  agent: 'claude',
  when: 'vor 3 Min',
  part: 'button',
  state: 'filled · hover',
  text: 'Hover ist jetzt eine Stufe heller, ich nehme accent-hover statt der Mischung. Reicht dir der Abstand zu active noch?',
  replies: 3,
  unread: true,
};

const rows = interactionRows<Props, 'rest' | 'selected', RowInteraction>(
  { rest: { thread: person }, selected: { thread: person, selected: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/comment-flow/comment-row.component.ts',
  note: 'One comment thread in the inbox list: avatar or agent logo, author, time, an unread dot, the latest message clamped to two lines, the part and state it sits on, and a reply count or a check when resolved. Selection lays an accent tint under the row and turns the part line accent. Hover lays the raised surface under the row, pressed a fill a step darker (over the tint when selected), and focus-visible draws an inset ring. A click, or Enter or Space on the focused row, picks the thread.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [320],
  controls: { row: { kind: 'row', input: ['pointer', 'keyboard'] } },
  states: {
    ...rows.states,
    agent: { thread: agent },
    resolved: { thread: { ...person, resolved: true } },
    'no-replies': { thread: { ...person, replies: 0 } },
  },
  grid: rows.grid,
  instant: 'Each state is another thread or a selection the list sets at once.',
  describe: {
    rest: 'A teammate thread row with initials, part, state, text and reply count; check that the text truncates and the count sits right.',
    'rest-hover':
      'The thread row hovered; check the faint raised fill under the whole row and that the text keeps its colour.',
    'rest-active': 'The thread row pressed; check the stronger press fill under the row.',
    'rest-focus-visible':
      'The thread row focused by keyboard; check the inset focus ring around the row, not clipped by the list edge.',
    selected: 'The same row selected; check the accent tint behind the whole row and that the text keeps its contrast.',
    'selected-hover':
      'The selected row hovered; check that the hover fill lies over the accent tint and the accent part line stays.',
    'selected-active': 'The selected row pressed; check the press fill over the accent tint.',
    'selected-focus-visible': 'The selected row focused by keyboard; check the inset focus ring over the accent tint.',
    agent: 'A thread by an AI agent; check that its logo replaces the initials avatar and keeps the same size.',
    resolved: 'A resolved thread; check the muted text and the check mark in place of the reply count.',
    'no-replies': 'A thread without replies; check that the reply count is gone and the row keeps its height.',
  },
  render: (props: Props) => drawing({ body: commentRow(props), styles }),
});
