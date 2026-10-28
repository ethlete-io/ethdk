import { definePart, drawing, html } from '@design-system';
import canvasFrames, { defaultFrames } from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import styles from './inbox.css?inline';

type Props = { showResolved: boolean };

type Comment = {
  id: string;
  author: string;
  initials: string;
  ai?: boolean;
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
    ai: true,
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
    author: 'Claude',
    initials: 'C',
    ai: true,
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
    author: 'Claude',
    initials: 'C',
    ai: true,
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
    author: 'Claude',
    initials: 'C',
    ai: true,
    when: 'Do',
    part: 'button',
    state: 'filled',
    text: 'Alle Labels lesen jetzt „Save“. Ich habe auch die Shots der Varianten neu erzeugt.',
    replies: 1,
    resolved: true,
  },
];

const SELECTED = 'c1';

const icon = (paths: string, cls: string) =>
  `<svg class="${cls}" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const replyIcon = icon('<path d="M6 4 2.5 7.5 6 11"/><path d="M2.5 7.5H9a4.5 4.5 0 0 1 4.5 4.5"/>', 'ib-icon');
const checkIcon = icon('<path d="m3.5 8.5 3 3 6-7"/>', 'ib-icon');

const toggle = (on: boolean) =>
  `<span class="ib-switch" role="switch" aria-checked="${on}"${on ? ' data-on' : ''}><span class="ib-switch-knob"></span></span>`;

const row = (c: Comment) =>
  html`<div class="ib-row" ${c.id === SELECTED ? ' data-selected' : ''}${c.resolved ? ' data-resolved' : ''}>
    <span class="ib-avatar" ${c.ai ? ' data-ai' : ''}>${c.initials}</span>
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

const pinned = (body: string, comments: Comment[]) => {
  let index = -1;
  return body.replace(/<div class="st-canvas-cell">/gu, (match) => {
    index += 1;
    const c = comments.find((comment) => comment.cell === index);
    if (!c) return match;
    return `<div class="st-canvas-cell ib-pinned"><span class="ib-pin"${c.id === SELECTED ? ' data-selected' : ''}>${c.initials}</span>`;
  });
};

export const open: Props = { showResolved: false };
export const withResolved: Props = { showResolved: true };

export default definePart<Props>({
  note: 'Inbox, flat: every thread of the product in one list, newest first, showing its latest message: mostly the exchange between the user and Claude, plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin.',
  madeBy: ['claude-opus-5-5'],
  states: { open, 'with-resolved': withResolved },
  render: async ({ showResolved }) => {
    const visible = COMMENTS.filter((c) => showResolved || !c.resolved);
    const unresolved = COMMENTS.filter((c) => !c.resolved).length;
    const frames = await canvasFrames.render(defaultFrames);
    const side = html`<div class="ib">
      <div class="ib-bar">
        <span class="ib-bar-title">${unresolved} offen</span>
        <label class="ib-toggle">Erledigte zeigen ${toggle(showResolved)}</label>
      </div>
      <div class="ib-list">${visible.map(row).join('')}</div>
    </div>`;
    const shell = await shellMain.render({
      section: 'Inbox',
      product: 'studio',
      side,
      content: pinned(frames.body, visible),
    });

    return drawing({ body: shell.body, styles: shell.styles + frames.styles + styles });
  },
});
