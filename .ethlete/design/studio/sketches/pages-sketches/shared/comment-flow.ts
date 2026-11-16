import { control } from '@ethlete/components/design/control';
import { html, withAction } from '@design-system';
import button from '@system/components/button';
import { commentDraft } from '@system/components/comment-draft';
import { commentPinMark } from '@system/components/comment-pin';
import { commentRow, commentRowStyles, type Thread } from '@system/components/comment-row';
import { commentTarget } from '@system/components/comment-target';

export type CommentPhase = 'listed' | 'mode' | 'draft';

type PlacedThread = Thread & { row: 'a' | 'b'; at: string };

const VARIANT_THREADS: PlacedThread[] = [
  {
    row: 'a',
    at: 'left-[18%] top-[30%]',
    author: 'human',
    initials: 'H',
    when: 'vor 20 Min',
    part: 'Entwurf 1',
    state: 'fit-hover',
    text: 'Die Pille wirkt hier zu eng, die Knöpfe kleben aneinander.',
    replies: 1,
  },
  {
    row: 'b',
    at: 'left-[52%] top-[55%]',
    author: 'Claude',
    initials: 'C',
    agent: 'claude',
    when: 'vor 4 Min',
    part: 'Entwurf 2',
    state: 'reset-hover',
    text: 'Halbfett liest sich besser. Soll Entwurf 1 die Zahl auch so bekommen?',
    replies: 2,
    unread: true,
  },
];

const DRAFT_AT = 'left-[30%] top-[40%]';

const pinOf = (thread: PlacedThread, selected: boolean) =>
  html`<span class="absolute z-10 flex -translate-y-full ${thread.at}" data-sk-comment-pin
    >${commentPinMark({
      author: thread.author,
      ...(thread.agent ? { agent: thread.agent } : { initials: thread.initials }),
      count: thread.replies + 1,
      ...(selected ? { selected: true } : {}),
    })}</span
  >`;

const TYPED = 'Der Reset-Knopf braucht hier mehr Luft zur Prozentzahl.';

export const commentButton = async (on: boolean) => {
  const drawn = await button.render({ label: 'Kommentar', variant: 'outline', size: 'sm', pressed: on });
  return { body: control(withAction(drawn.body, on ? 'comments' : 'comments-mode'), 'comment'), styles: drawn.styles };
};

export const commentLayer = async (row: string, phase: CommentPhase | undefined) => {
  if (!phase) return { body: '', styles: '' };
  const pins = VARIANT_THREADS.filter((thread) => thread.row === row)
    .map((thread) => pinOf(thread, phase === 'listed' && thread === VARIANT_THREADS[0]))
    .join('');
  const target =
    phase !== 'listed' && row !== 'current'
      ? control(commentTarget({ frame: row, action: 'comments-draft' }), 'comment-target')
      : '';
  const drafting = phase === 'draft' && row === 'b';
  const draft = drafting ? await commentDraft({ text: TYPED }) : undefined;
  const draftPin = drafting
    ? html`<span class="absolute z-10 flex -translate-y-full ${DRAFT_AT}"
        >${commentPinMark({ author: 'human', initials: 'H', selected: true })}</span
      >`
    : '';
  const card = draft
    ? html`<div class="absolute top-[40%] left-[calc(30%+var(--space-6))] z-20">${draft.body}</div>`
    : '';
  return { body: target + pins + draftPin + card, styles: draft?.styles ?? '' };
};

const listHead = (count: number) =>
  html`<div class="flex items-center gap-space-2 px-space-2 py-space-1">
    <span class="text-ui-sm font-ui-strong text-et-surface">Kommentare</span>
    <span class="text-ui-xs text-et-surface-muted">${count} offen</span>
  </div>`;

export const commentList = (phase: CommentPhase) => ({
  body: html`<section class="flex flex-col gap-space-1" aria-label="Kommentare">
    ${listHead(VARIANT_THREADS.length)}
    ${VARIANT_THREADS.map((thread, index) => commentRow({ thread, selected: phase === 'listed' && index === 0 })).join('')}
  </section>`,
  styles: commentRowStyles,
});
