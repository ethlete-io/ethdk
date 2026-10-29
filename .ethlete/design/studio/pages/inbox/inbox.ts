import { definePart, drawing, html } from '@design-system';
import commentPin, { commentPinMark } from '@system/components/comment-pin';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';
import styles from './inbox.css?inline';

type Props = { showResolved: boolean; openOn: 'all' | 'active' | 'others' | 'none' };

type Comment = {
  id: string;
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
  cell?: number;
};

const COMMENTS: Comment[] = [
  {
    id: 'c1',
    author: 'Claude',
    initials: 'C',
    agent: 'claude',
    when: 'vor 3 Min',
    part: 'button',
    state: 'filled · hover',
    text: 'Hover ist jetzt eine Stufe heller, ich nehme accent-hover statt der Mischung. Reicht dir der Abstand zu active noch?',
    replies: 3,
    unread: true,
    cell: 1,
  },
  {
    id: 'c2',
    author: 'Codex',
    initials: 'CX',
    agent: 'codex',
    when: 'vor 20 Min',
    part: 'button',
    state: 'outline · disabled',
    text: 'Ich habe zwei Wege skizziert: den Rand auf 3:1 heben oder eine leise Fläche statt Rand. Beide liegen als Runde 2 unter Sketches.',
    replies: 1,
    unread: true,
    cell: 11,
  },
  {
    id: 'c3',
    author: 'Tom Bornholdt',
    initials: 'TB',
    when: 'vor 1 Std',
    part: 'button',
    state: 'tonal · rest',
    text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.',
    replies: 0,
    cell: 12,
  },
  {
    id: 'c4',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'gestern',
    part: 'form-field',
    state: 'default',
    text: 'QC: Label und Feld sitzen hier enger als bei select. Gewollt oder Drift?',
    replies: 0,
  },
  {
    id: 'c5',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'gestern',
    part: 'select',
    state: 'open',
    text: 'QC: Die offene Liste deckt den Hilfetext ab. Bitte nachziehen, bevor wir das Formular bauen.',
    replies: 0,
  },
  {
    id: 'c6',
    author: 'Gemini',
    initials: 'G',
    agent: 'gemini',
    when: 'Mo',
    part: 'system',
    state: 'part',
    text: 'Die Baumzeilen sind jetzt 24 px hoch. Die Schrift bleibt dicht, nur die Trefferfläche wächst. Runde 3 zeigt beide Höhen nebeneinander.',
    replies: 4,
  },
  {
    id: 'c7',
    author: 'Tom Bornholdt',
    initials: 'TB',
    when: 'Fr',
    part: 'button',
    state: 'filled · focus-visible',
    text: 'Der Fokusring verschwindet auf der dunklen Fläche. Mach ihn sichtbar.',
    replies: 2,
    resolved: true,
  },
  {
    id: 'c8',
    author: 'Codex',
    initials: 'CX',
    agent: 'codex',
    when: 'Do',
    part: 'button',
    state: 'filled',
    text: 'Alle Labels lesen jetzt „Save“. Ich habe auch die Shots der Varianten neu erzeugt.',
    replies: 1,
    resolved: true,
  },
];

const SELECTED = 'c1';
const ACTIVE_PART = 'button';

const icon = (paths: string, cls: string) =>
  `<svg class="${cls}" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const replyIcon = icon('<path d="M6 4 2.5 7.5 6 11"/><path d="M2.5 7.5H9a4.5 4.5 0 0 1 4.5 4.5"/>', 'ib-icon');
const checkIcon = icon('<path d="m3.5 8.5 3 3 6-7"/>', 'ib-icon');

const toggle = (on: boolean) =>
  `<span class="ib-switch" role="switch" aria-checked="${on}"${on ? ' data-on' : ''}><span class="ib-switch-knob"></span></span>`;

const row = (c: Comment) =>
  html`<div class="ib-row" ${c.id === SELECTED ? ' data-selected' : ''}${c.resolved ? ' data-resolved' : ''}>
    <span class="ib-avatar" ${c.agent ? ' data-agent' : ''}
      >${c.agent ? agentLogo(c.agent, 'ib-logo') : c.initials}</span
    >
    <div class="ib-row-body">
      <div class="ib-row-meta">
        <span class="ib-author">${c.author}</span>
        <span class="ib-when">${c.when}</span>
        ${c.unread ? '<span class="ib-unread" title="Ungelesen"></span>' : ''}
      </div>
      <p class="ib-text">${c.text}</p>
      <div class="ib-row-foot">
        <span class="ib-where">${c.part} › ${c.state}</span>
        ${c.resolved ? `<span class="ib-count">${checkIcon}</span>` : c.replies > 0 ? `<span class="ib-count">${replyIcon}${c.replies}</span>` : ''}
      </div>
    </div>
  </div>`;

const groupHead = (title: string, count: number) =>
  `<div class="ib-group"><span class="ib-group-title">${title}</span><span>${count}</span></div>`;

const group = (title: string, comments: Comment[]) =>
  comments.length === 0 ? '' : groupHead(title, comments.length) + comments.map(row).join('');

const activeGroup = (comments: Comment[]) =>
  comments.length === 0
    ? `${groupHead(ACTIVE_PART, 0)}<p class="ib-group-empty">Keine offenen Kommentare zu ${ACTIVE_PART}.</p>`
    : group(ACTIVE_PART, comments);

const empty = `<div class="ib-empty">${icon('<path d="m3.5 8.5 3 3 6-7"/>', 'ib-empty-icon')}<p class="ib-empty-title">Keine offenen Kommentare</p><p class="ib-empty-text">Kommentare von dir, deinem Agenten und dem Team erscheinen hier.</p></div>`;

const pinned = (body: string, comments: Comment[], pin: (c: Comment) => string) => {
  let index = -1;
  return body.replace(/<div class="st-sgrid-cell">/gu, (match) => {
    index += 1;
    const c = comments.find((comment) => comment.cell === index);
    if (!c) return match;
    return `<div class="st-sgrid-cell ib-pinned"><span class="ib-pin-at">${pin(c)}</span>`;
  });
};

export const open: Props = { showResolved: false, openOn: 'all' };
export const withResolved: Props = { showResolved: true, openOn: 'all' };
export const activeOnly: Props = { showResolved: false, openOn: 'active' };
export const activeClear: Props = { showResolved: false, openOn: 'others' };
export const allClear: Props = { showResolved: false, openOn: 'none' };

export default definePart<Props>({
  note: 'Inbox, flat: every thread of the product, newest first, in two groups: the part on the canvas on top, all others below, showing its latest message: mostly the exchange between the user and their AI agent (Claude, Codex and Gemini in this sample), plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin. States cover open comments only on the active part, an active part with no open comments, and no open comments at all.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: {
    open,
    'with-resolved': withResolved,
    'active-only': activeOnly,
    'active-clear': activeClear,
    'all-clear': allClear,
  },
  render: async ({ showResolved, openOn }) => {
    const comments = COMMENTS.filter(
      (c) =>
        c.resolved ||
        openOn === 'all' ||
        (openOn === 'active' && c.part === ACTIVE_PART) ||
        (openOn === 'others' && c.part !== ACTIVE_PART),
    );
    const visible = comments.filter((c) => showResolved || !c.resolved);
    const unresolved = comments.filter((c) => !c.resolved).length;
    const frames = await canvasFrames.render(canvasFrames.states.default);
    const pins = new Map(
      visible.map((c) => [
        c.id,
        commentPinMark({
          author: c.author,
          initials: c.initials,
          ...(c.agent ? { agent: c.agent } : {}),
          selected: c.id === SELECTED,
        }),
      ]),
    );
    const side = html`<div class="ib">
      <div class="ib-bar">
        <span class="ib-bar-title">${unresolved} offen</span>
        <label class="ib-toggle">Erledigte zeigen ${toggle(showResolved)}</label>
      </div>
      <div class="ib-list">
        ${visible.length === 0 ? empty : activeGroup(visible.filter((c) => c.part === ACTIVE_PART))}${group(
          'Andere',
          visible.filter((c) => c.part !== ACTIVE_PART),
        )}
      </div>
    </div>`;
    const shell = await shellMain.render({
      section: 'Inbox',
      product: 'studio',
      side,
      content: pinned(frames.body, visible, (c) => pins.get(c.id) ?? ''),
    });

    return drawing({ body: shell.body, styles: shell.styles + frames.styles + commentPin.styles + styles });
  },
});
