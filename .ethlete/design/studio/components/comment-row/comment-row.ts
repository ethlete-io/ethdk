import { definePart, drawing, html } from '@design-system';
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

type Props = { thread: Thread; selected?: boolean };

const replyIcon = icon('reply', { size: 14, cls: 'flex-none' });
const checkIcon = icon('check', { size: 14, cls: 'flex-none' });

const countClass = 'flex items-center gap-0.5 text-et-surface-muted';

export const commentRowStyles = styles;

export const commentRow = ({ thread: c, selected = false }: Props) => {
  const strong = c.resolved ? 'text-et-surface-muted' : 'text-et-surface';

  return html`<div
    class="flex gap-space-2 p-space-2 rounded-control-md cursor-pointer ${selected ? 'bg-et-theme/20' : ''}"
    data-et-control="row"
    data-et-action="emit:pick"
    role="button"
    tabindex="0"
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
  </div>`;
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

export default definePart({
  note: 'One comment thread in the inbox list: avatar or agent logo, author, time, an unread dot, the latest message clamped to two lines, the part and state it sits on, and a reply count or a check when resolved. Selection lays an accent tint under the row and turns the part line accent. A click, or Enter or Space on the focused row, picks the thread.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [320],
  controls: { row: { kind: 'row', input: ['pointer', 'keyboard'] } },
  states: {
    rest: { thread: person },
    selected: { thread: person, selected: true },
    agent: { thread: agent },
    resolved: { thread: { ...person, resolved: true } },
    'no-replies': { thread: { ...person, replies: 0 } },
  },
  instant: 'Each state is another thread or a selection the list sets at once.',
  render: (props: Props) => drawing({ body: commentRow(props), styles }),
});
