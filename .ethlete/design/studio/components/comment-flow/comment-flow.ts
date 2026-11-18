import { control } from '@ethlete/components/design/control';
import { kbd, kbdStyles } from '@ethlete/components/design/kbd';
import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import { commentDraft } from '@system/components/comment-draft';
import { commentPinMark } from '@system/components/comment-pin';
import { commentRow, commentRowStyles, type Thread } from '@system/components/comment-row';
import { commentTarget } from '@system/components/comment-target';
import textarea from '@system/components/textarea';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';
import { icon } from '@system/foundations/icons';

export type CommentPhase = 'listed' | 'mode' | 'draft' | 'thread';

export type ThreadMessage = {
  author: string;
  initials: string;
  agent?: Agent;
  when: string;
  text: string;
  own?: boolean;
};

export type ReplyPhase = 'busy' | 'error' | 'rejected';

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

/** The hint beside the pressed Kommentar toggle that Esc or C leaves comment mode. */
export const commentModeHint = () => ({
  body: html`<span class="self-center flex items-center gap-space-1 text-ui-xs text-et-surface-muted whitespace-nowrap"
    >${kbd({ keys: ['Esc'] })} oder ${kbd({ keys: ['C'] })} beendet</span
  >`,
  styles: kbdStyles,
});

const problem = (text: string) =>
  html`<p
    class="m-0 flex items-center gap-space-1 text-et-theme-ink text-ui-xs"
    data-et-semantic-color="error"
    role="alert"
  >
    ${icon('error', { size: 14, cls: 'flex-none text-et-theme' })}<span>${text}</span>
  </p>`;

const avatar = (m: ThreadMessage) =>
  html`<span
    class="st-crow-avatar flex flex-none items-center justify-center size-5 bg-et-surface-bg text-et-surface text-(length:--text-xs) font-ui-strong"
    data-et-auto-surface
    >${m.agent ? agentLogo(m.agent, 'size-3') : m.initials}</span
  >`;

type ThreadCardProps = {
  place: string;
  messages: ThreadMessage[];
  closeTo: string;
  text?: string;
  phase?: ReplyPhase;
  reason?: string;
};

/** The thread of an opened pin as a card: place, Erledigen and close, the messages, and the reply field. `closeTo` is the state the close button leads to. */
export const threadCard = async ({ place, messages, closeTo, text = '', phase, reason = '' }: ThreadCardProps) => {
  const busy = phase === 'busy';
  const close = await button.render({
    iconOnly: true,
    icon: icon('close', { size: 14 }),
    ariaLabel: 'Faden schließen',
    variant: 'transparent',
    color: 'surface',
    size: 'xs',
  });
  const resolve = await button.render({
    label: 'Erledigen',
    icon: icon('check', { size: 14 }),
    variant: 'outline',
    color: 'surface',
    size: 'xs',
  });
  const withdraw = await button.render({ label: 'Zurückziehen', variant: 'transparent', color: 'surface', size: 'xs' });
  const field = await textarea.render({
    field: {
      id: 'thread-reply',
      placeholder: 'Antworten…',
      rows: 2,
      ariaLabel: 'Antwort',
      disabled: busy,
      ...(busy ? {} : { focused: true, force: 'focus-visible' as const }),
      ...(text ? { value: text } : {}),
    },
  });
  const send = await button.render({
    label: phase === 'error' ? 'Erneut senden' : 'Antworten',
    variant: 'filled',
    size: 'xs',
    disabled: !text,
    loading: busy,
  });
  const sendMarkup = busy || !text ? send.body : withAction(send.body, 'emit:replyComment');
  const withdrawAction = control(withAction(withdraw.body, 'emit:withdrawComment'), 'thread-withdraw');

  const message = (m: ThreadMessage) =>
    html`<li class="flex gap-space-2">
      ${avatar(m)}
      <div class="flex flex-1 flex-col gap-0.5 min-w-0">
        <div class="flex items-center gap-space-1 text-ui-xs whitespace-nowrap">
          <span class="text-et-surface font-ui-medium">${m.author}</span>
          <span class="flex-1 text-et-surface-muted">${m.when}</span>
        </div>
        <p class="m-0 text-et-surface text-ui-sm">${m.text}</p>
        ${m.own ? html`<div class="-ml-space-2 flex">${withdrawAction}</div>` : ''}
      </div>
    </li>`;

  return {
    body: html`<div
      class="relative z-20 flex flex-col w-80 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) shadow-lg"
      data-et-auto-surface
      role="dialog"
      aria-label="Kommentar-Faden"
    >
      <div class="flex items-center gap-space-2 border-b border-et-surface-border px-space-3 py-space-2">
        <span
          class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-code text-ui-xs text-et-surface-muted"
          >${place}</span
        >
        ${control(withAction(resolve.body, 'emit:resolveThread'), 'thread-resolve')}${control(
          withAction(close.body, closeTo),
          'thread-close',
        )}
      </div>
      <ol class="m-0 flex list-none flex-col gap-space-3 overflow-auto p-space-3 max-h-96">
        ${messages.map(message).join('')}
      </ol>
      <div class="flex flex-col gap-space-2 border-t border-et-surface-border p-space-3">
        ${field.body}${phase === 'error' ? problem('Kommentar nicht gesendet. Erneut versuchen.') : phase === 'rejected' ? problem(reason) : ''}
        <div class="flex items-center justify-between gap-space-2">
          <span class="flex items-center gap-space-1 text-ui-xs text-et-surface-muted"
            >${kbd({ keys: ['Esc'] })} schließt</span
          >
          ${control(sendMarkup, 'thread-send')}
        </div>
      </div>
    </div>`,
    styles: close.styles + resolve.styles + withdraw.styles + field.styles + send.styles + kbdStyles,
  };
};

/** The thread card on the frame, at the position class `at` beside its pin. */
export const threadCardAt = async (at: string, props: ThreadCardProps) => {
  const card = await threadCard(props);
  return { body: html`<div class="absolute ${at}">${card.body}</div>`, styles: card.styles };
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

const SAMPLE_REPLY = 'Ja, der Abstand reicht. Lass es so.';

const SAMPLE_DRAFT_AT = 'left-[38%] top-[42%]';

const SAMPLE_MESSAGES: ThreadMessage[] = [
  { author: 'human', initials: 'H', own: true, when: 'vor 3 Std', text: 'Die Tonal-Fläche ist zu blass.' },
  { author: 'Claude', initials: 'C', agent: 'claude', when: 'vor 2 Std', text: 'Ich hebe sie um eine Stufe an.' },
  {
    author: 'human',
    initials: 'H',
    own: true,
    when: 'vor 1 Std',
    text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.',
  },
];

type Props = { phase?: CommentPhase; threads?: PlacedThread[]; reply?: string; replyPhase?: ReplyPhase };

export default definePart({
  note: 'The one comment flow of every view that shows a design (ADR 0322), after pages/system variant b: the Kommentar toggle at the top right of the canvas, numbered pins on the frame, the crosshair layer in comment mode, the draft card beside its pin, and the open comments listed in the side panel under the tree. The view passes its own threads with their pin positions as data. listed shows the list with the first thread selected, mode turns the toggle on with the hint that Esc or C leaves comment mode and lays the crosshair over the frame, draft adds the new pin and the draft card, thread opens a pin as its thread card beside it: the place, Erledigen and close, the messages with Zurückziehen under each own one, and a focused reply field with Antworten; Esc or close shuts it.',
  madeBy: ['claude-opus-5-5'],
  widths: [720],
  motions: { 'thread-busy': { from: 'thread-busy', to: 'thread-busy' } },
  instant:
    'Comment mode, the pins, the draft card and the list appear and go at once; only the Antworten spinner loops while a reply is sent.',
  controls: {
    comment: { kind: 'button', part: 'components/button' },
    'comment-target': { kind: 'button', part: 'components/comment-target' },
    'comment-cancel': { kind: 'button', part: 'components/button' },
    'comment-send': { kind: 'button', part: 'components/button' },
    'thread-close': { kind: 'button', part: 'components/button' },
    'thread-resolve': { kind: 'button', part: 'components/button' },
    'thread-withdraw': { kind: 'button', part: 'components/button' },
    'thread-send': { kind: 'button', part: 'components/button', disabled: true },
  },
  states: {
    rest: {},
    listed: { phase: 'listed' },
    mode: { phase: 'mode' },
    draft: { phase: 'draft' },
    thread: { phase: 'thread' },
    'thread-busy': { phase: 'thread', reply: SAMPLE_REPLY, replyPhase: 'busy' },
    'thread-error': { phase: 'thread', reply: SAMPLE_REPLY, replyPhase: 'error' },
  },
  describe: {
    rest: 'The frame before any comment; check that only the Kommentar toggle shows above it, with no pins and no list.',
    listed:
      'The comment list beside the frame with the first thread selected; check that its pin is highlighted and the numbers match the list.',
    mode: 'Comment mode on; check the pressed Kommentar toggle with the Esc oder C beendet hint beside it, the accent wash with a crosshair over the frame and the pins above it.',
    draft:
      'A draft at a clicked point in comment mode; check the draft pin and the card beside it, clear of the numbered pins.',
    thread:
      'A clicked pin opened as its thread card beside it; check the place, Erledigen and close, Zurückziehen under both own messages, the focused reply field and Esc schließt.',
    'thread-busy':
      'A reply being sent; check that the field is disabled with the reply kept and Antworten shows its spinner.',
    'thread-error':
      'A reply that failed on the network or server; check Kommentar nicht gesendet. Erneut versuchen. under the field, the kept reply and Erneut senden.',
  },
  render: async ({ phase, threads = SAMPLE_THREADS, reply, replyPhase }: Props) => {
    const toggle = await commentButton({ on: phase === 'mode' || phase === 'draft', action: phase ? 'rest' : 'mode' });
    const hint = phase === 'mode' ? commentModeHint() : undefined;
    const opened =
      phase === 'thread'
        ? await threadCardAt('left-[calc(22%+var(--space-6))] top-[calc(30%-var(--space-6))]', {
            place: 'button › tonal · rest',
            messages: SAMPLE_MESSAGES,
            closeTo: 'listed',
            text: reply,
            phase: replyPhase,
          })
        : undefined;
    const writing =
      phase === 'draft'
        ? await commentDraftAt(`left-[calc(38%+var(--space-6))] top-[42%]`, { text: 'Der Abstand passt jetzt.' })
        : undefined;
    const selected = phase === 'listed' || phase === 'thread' ? 0 : -1;
    const list = phase ? commentList(threads, selected) : undefined;
    const frame = html`<div class="relative h-80 rounded-md border border-et-surface-border">
      ${phase ? commentPins(threads, selected) : ''}${
        phase === 'mode' || phase === 'draft' ? commentLayer('button', 'draft') : ''
      }${writing ? draftPin(SAMPLE_DRAFT_AT) + writing.body : ''}${opened?.body ?? ''}
    </div>`;
    return drawing({
      body: html`<div class="grid grid-cols-[14rem_1fr] gap-space-3 p-space-3">
        <aside class="flex flex-col">${list ? withCommentList('', list.body) : ''}</aside>
        <div class="relative flex flex-col gap-space-2">
          <div class="flex items-center justify-end gap-space-2">${hint?.body ?? ''}${toggle.body}</div>
          ${frame}
        </div>
      </div>`,
      styles:
        toggle.styles + (list?.styles ?? '') + (writing?.styles ?? '') + (hint?.styles ?? '') + (opened?.styles ?? ''),
    });
  },
});
