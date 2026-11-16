import { html } from '@design-system';
import { commentPinMark } from '@system/components/comment-pin';
import { commentRow, commentRowStyles, type Thread } from '@system/components/comment-row';

const PART_THREADS: Thread[] = [
  {
    author: 'human',
    initials: 'H',
    when: 'vor 1 Std',
    part: 'button',
    state: 'tonal · rest',
    text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.',
    replies: 2,
  },
  {
    author: 'Claude',
    initials: 'C',
    agent: 'claude',
    when: 'vor 3 Min',
    part: 'button',
    state: 'filled · hover',
    text: 'Hover ist jetzt eine Stufe heller. Reicht dir der Abstand zu active noch?',
    replies: 3,
    unread: true,
  },
];

const PIN_PLACES = ['left-[22%] top-[30%]', 'left-[58%] top-[52%]'];

export const partPins = (selected = 0) =>
  PART_THREADS.map(
    (thread, index) =>
      html`<span class="absolute z-10 flex -translate-y-full ${PIN_PLACES[index]}"
        >${commentPinMark({
          author: thread.author,
          ...(thread.agent ? { agent: thread.agent } : { initials: thread.initials }),
          count: thread.replies + 1,
          ...(index === selected ? { selected: true } : {}),
        })}</span
      >`,
  ).join('');

const NEW_PIN = 'left-[38%] top-[42%]';

export const draftPin = html`<span class="absolute z-10 flex -translate-y-full ${NEW_PIN}"
  >${commentPinMark({ author: 'human', initials: 'H', selected: true })}</span
>`;

const listHead = (count: number) =>
  html`<div class="flex items-center gap-space-2 px-space-2 py-space-1">
    <span class="text-ui-sm font-ui-strong text-et-surface">Kommentare</span>
    <span class="text-ui-xs text-et-surface-muted">${count} offen</span>
  </div>`;

export const commentList = (selected = 0) => ({
  body: html`<section class="flex flex-col gap-space-1" aria-label="Kommentare">
    ${listHead(PART_THREADS.length)}
    ${PART_THREADS.map((thread, index) => commentRow({ thread, selected: index === selected })).join('')}
  </section>`,
  styles: commentRowStyles,
});
