import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import { commentDraft } from '@system/components/comment-draft';
import { commentPinMark } from '@system/components/comment-pin';
import { commentRow, commentRowStyles, type Thread } from '@system/components/comment-row';
import { commentTarget } from '@system/components/comment-target';

export type CommentPhase = 'listed' | 'mode' | 'draft';

/** A thread with the position class of its pin on the frame, e.g. `left-[22%] top-[30%]`. */
export type PlacedThread = Thread & { at: string };

type DraftProps = Parameters<typeof commentDraft>[0];

const pinAt = (at: string, mark: string) =>
  html`<span class="absolute z-10 flex -translate-y-full ${at}">${mark}</span>`;

/** The Kommentar toggle; `action` makes it clickable in a page state. */
export const commentButton = async ({ on, action }: { on: boolean; action?: string }) => {
  const drawn = await button.render({ label: 'Kommentar', variant: 'outline', size: 'sm', pressed: on });
  const body = action === undefined ? drawn.body : withAction(drawn.body, action);
  return { body: control(body, 'comment'), styles: drawn.styles };
};

/** The pins of `threads` on a `relative` frame; `selected` is the index of the selected one, -1 for none. */
export const commentPins = (threads: PlacedThread[], selected = -1) =>
  threads
    .map((thread, index) =>
      pinAt(
        thread.at,
        commentPinMark({
          author: thread.author,
          ...(thread.agent ? { agent: thread.agent } : { initials: thread.initials }),
          count: thread.replies + 1,
          ...(index === selected ? { selected: true } : {}),
        }),
      ),
    )
    .join('');

/** The pin of the comment being written, at `at`. */
export const draftPin = (at: string) => pinAt(at, commentPinMark({ author: 'human', initials: 'H', selected: true }));

/** The comment-mode layer over the frame named `frame`; a click starts a draft through `action`. */
export const commentLayer = (frame: string, action: string) =>
  control(commentTarget({ frame, action }), 'comment-target');

/** The draft card on the frame, at the position class `at`. */
export const commentDraftAt = async (at: string, props: DraftProps) => {
  const draft = await commentDraft(props);
  return { body: html`<div class="absolute ${at}">${draft.body}</div>`, styles: draft.styles };
};

const listHead = (count: number) =>
  html`<div class="flex items-center gap-space-2 px-space-2 py-space-1">
    <span class="text-ui-sm font-ui-strong text-et-surface">Kommentare</span>
    <span class="text-ui-xs text-et-surface-muted">${count} offen</span>
  </div>`;

/** The open comments of a view; `selected` is the index of the selected row, -1 for none. */
export const commentList = (threads: Thread[], selected = -1) => ({
  body: html`<section class="flex flex-col gap-space-1" aria-label="Kommentare">
    ${listHead(threads.length)}
    ${threads.map((thread, index) => commentRow({ thread, selected: index === selected })).join('')}
  </section>`,
  styles: commentRowStyles,
});

/** The side panel `side` (the tree) with the comment list `list` under it. */
export const withCommentList = (side: string, list: string) =>
  html`${side}
    <div class="mx-space-2 mt-space-3 border-t border-et-surface-border pt-space-2" data-comment-list>${list}</div>`;

const SAMPLE_THREADS: PlacedThread[] = [
  {
    at: 'left-[22%] top-[30%]',
    author: 'human',
    initials: 'H',
    when: 'vor 1 Std',
    part: 'button',
    state: 'tonal · rest',
    text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.',
    replies: 2,
  },
  {
    at: 'left-[58%] top-[52%]',
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

const SAMPLE_DRAFT_AT = 'left-[38%] top-[42%]';

type Props = { phase?: CommentPhase; threads?: PlacedThread[] };

export default definePart({
  note: 'The one comment flow of every view that shows a design (ADR 0322), after pages/system variant b: the Kommentar toggle at the top right of the canvas, numbered pins on the frame, the crosshair layer in comment mode, the draft card beside its pin, and the open comments listed in the side panel under the tree. The view passes its own threads with their pin positions as data. listed shows the list with the first thread selected, mode turns the toggle on and lays the crosshair over the frame, draft adds the new pin and the draft card.',
  madeBy: ['claude-opus-5-5'],
  widths: [720],
  instant:
    'Comment mode, the pins, the draft card and the list appear and go at once; nothing moves between the phases.',
  controls: {
    comment: { kind: 'button', part: 'components/button' },
    'comment-target': { kind: 'button', part: 'components/comment-target' },
    'comment-cancel': { kind: 'button', part: 'components/button' },
    'comment-send': { kind: 'button', part: 'components/button' },
  },
  states: {
    rest: {},
    listed: { phase: 'listed' },
    mode: { phase: 'mode' },
    draft: { phase: 'draft' },
  },
  render: async ({ phase, threads = SAMPLE_THREADS }: Props) => {
    const toggle = await commentButton({ on: phase === 'mode' || phase === 'draft', action: phase ? 'rest' : 'mode' });
    const writing =
      phase === 'draft'
        ? await commentDraftAt(`left-[calc(38%+var(--space-6))] top-[42%]`, { text: 'Der Abstand passt jetzt.' })
        : undefined;
    const list = phase ? commentList(threads, phase === 'listed' ? 0 : -1) : undefined;
    const frame = html`<div class="relative h-80 rounded-md border border-et-surface-border">
      ${phase ? commentPins(threads, phase === 'listed' ? 0 : -1) : ''}${
        phase === 'mode' || phase === 'draft' ? commentLayer('button', 'draft') : ''
      }${writing ? draftPin(SAMPLE_DRAFT_AT) + writing.body : ''}
    </div>`;
    return drawing({
      body: html`<div class="grid grid-cols-[14rem_1fr] gap-space-3 p-space-3">
        <aside class="flex flex-col">${list ? withCommentList('', list.body) : ''}</aside>
        <div class="relative flex flex-col gap-space-2">
          <div class="flex justify-end">${toggle.body}</div>
          ${frame}
        </div>
      </div>`,
      styles: toggle.styles + (list?.styles ?? '') + (writing?.styles ?? ''),
    });
  },
});
