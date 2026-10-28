import { definePart, drawing, html } from '@design-system';
import canvasFrames, { defaultFrames } from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import styles from './inbox.css?inline';

type Props = { showResolved: boolean };

type Comment = {
  id: string;
  author: string;
  initials: string;
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
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'vor 12 Min',
    part: 'button',
    state: 'filled · hover',
    text: 'Der Hover-Ton ist kaum vom Ruhezustand zu unterscheiden. Bitte eine Stufe heller, sonst merkt man den Zeiger nicht.',
    replies: 1,
    unread: true,
    cell: 1,
  },
  {
    id: 'c2',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'vor 40 Min',
    part: 'button',
    state: 'outline · disabled',
    text: 'Outline im disabled-Zustand liegt unter 3:1 Kontrast. Das liest sich wie ein Platzhalter, nicht wie ein Button.',
    replies: 0,
    unread: true,
    cell: 11,
  },
  {
    id: 'c3',
    author: 'Jonas Weber',
    initials: 'JW',
    when: 'vor 2 Std',
    part: 'button',
    state: 'tonal · rest',
    text: '32 px Höhe wirkt neben dem Form-Field zu klein. Können wir auf 36 gehen?',
    replies: 2,
    cell: 12,
  },
  {
    id: 'c4',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'gestern',
    part: 'form-field',
    state: 'default',
    text: 'Zwischen Label und Feld sind es 4 px, überall sonst 6 px. Bitte angleichen.',
    replies: 1,
  },
  {
    id: 'c5',
    author: 'Jonas Weber',
    initials: 'JW',
    when: 'gestern',
    part: 'select',
    state: 'open',
    text: 'Die offene Liste überdeckt den Hilfetext. 4 px Abstand nach oben würden reichen.',
    replies: 0,
  },
  {
    id: 'c6',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'Mo',
    part: 'system',
    state: 'part',
    text: 'Die Baumzeilen sind mit 20 px sehr eng, am Touchpad treffe ich sie schwer.',
    replies: 3,
  },
  {
    id: 'c7',
    author: 'Jonas Weber',
    initials: 'JW',
    when: 'Fr',
    part: 'button',
    state: 'filled · focus-visible',
    text: 'Fokusring verschwindet auf dunkler Fläche komplett.',
    replies: 2,
    resolved: true,
  },
  {
    id: 'c8',
    author: 'Lena Krüger',
    initials: 'LK',
    when: 'Do',
    part: 'button',
    state: 'filled',
    text: 'Label bitte überall „Save“, nicht mal „Speichern“, mal „Save“.',
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
    <span class="ib-avatar">${c.initials}</span>
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
  note: 'Inbox, flat: every comment of the product in one list, newest first, with the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin.',
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
