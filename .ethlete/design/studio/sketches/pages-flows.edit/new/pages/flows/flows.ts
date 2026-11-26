import { definePart, drawing, html } from '@design-system';
import { control } from '@ethlete/components/design/control';
import {
  commentDraftAt,
  commentLayer,
  commentModeHint,
  commentPins,
  type PlacedThread,
  threadCard,
  type ThreadMessage,
} from '@system/components/comment-flow';
import { commentRowStyles } from '@system/components/comment-row';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import zoomChip from '@system/components/zoom-chip';
import { canvasViewport, canvasViewportStyles } from '@system/components/canvas-viewport';
import { SKETCHES_LABELS } from '../../../../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';
import {
  FLOW_NAME,
  FLOW_NOTES,
  ORPHAN_NOTES,
  ORPHAN_TITLE,
  type FlowNoteSample,
  type FlowProps,
  addNoteButton,
  commentToggleButton,
  copyButton,
  emptyCanvasOf,
  emptySide,
  flatFlowList,
  flowGraph,
  noteDeleteButton,
  noteField,
  orphanButtons,
  pageHeader,
  pagePadding,
  presetPickerOf,
} from '@shared/flow-data';

const TRAY =
  'rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border)) bg-et-surface-background shadow-(--et-anchored-panel-shadow,0_10px_24px_color-mix(in_srgb,var(--et-shadow-color,rgb(0_0_0))_16%,transparent))';

const NOTE_CLASS =
  'w-64 box-border p-space-3 rounded-md border border-et-surface-border bg-et-surface-background shadow-lg text-ui-md text-et-surface-text cursor-grab';

const noteOf = (note: FlowNoteSample, remove: string, field: string) =>
  html`<div class="absolute ${NOTE_CLASS}" style="left:${note.x}px;top:${note.y}px" data-flow-note>
    <div class="flex items-start gap-space-1">
      ${note.text ? `<p class="m-0 flex-1 whitespace-pre-wrap">${note.text}</p>` : `<div class="flex-1">${field}</div>`}
      ${control(remove, 'note-delete')}
    </div>
  </div>`;

const orphanSection = (entries: string[]) =>
  html`<section class="mt-space-4 flex flex-col gap-space-1">
    <h2 class="m-0 px-space-3 text-ui-xs font-ui-strong text-et-surface-text-muted">
      ${ORPHAN_TITLE} · ${entries.length}
    </h2>
    <div class="flex flex-col items-stretch">
      ${entries.length ? entries.join('') : '<p class="m-0 px-space-3 text-ui-sm text-et-surface-text-muted">Keine</p>'}
    </div>
  </section>`;

const SCALE = 0.18;
const COMMENTED = 'plant';

const FLOW_THREAD: PlacedThread = {
  author: 'Hanna',
  initials: 'H',
  when: 'vor 2 Std.',
  part: 'pages/shop',
  state: '2',
  text: 'Der Korb-Knopf ist hier zu leise.',
  replies: 0,
  at: '',
};

const FLOW_MESSAGES: ThreadMessage[] = [
  { author: 'Hanna', initials: 'H', when: 'vor 2 Std.', text: FLOW_THREAD.text },
  { author: 'human', initials: 'H', own: true, when: 'vor 1 Std.', text: 'Ich ziehe ihn eine Stufe an.' },
];

const COMMENT_POINT = { x: 520, y: 301 };
const DRAFT_POINT = { x: 900, y: 520 };

const placedAt = (point: { x: number; y: number }, scale: number, body: string) =>
  `<div class="absolute" style="left: ${point.x * scale}px; top: ${point.y * scale}px">${body}</div>`;

const contentOf = (
  presetPicker: string,
  zoom: string,
  add: string,
  notes: string,
  header: { comment: string; hint: string },
  onShot?: (id: string, shot: { scale: number }) => string,
) =>
  html`<div class="relative h-full overflow-hidden" data-et-skip="CLIPPED">
    <div class="h-full box-border flex flex-col gap-space-4 ${pagePadding}">
      ${pageHeader(FLOW_NAME, `${header.hint}<div class="w-60">${presetPicker}</div>`)}
      ${canvasViewport({ class: 'flex-1 min-h-0', body: flowGraph(SCALE, 140, notes, onShot) })}
    </div>
    <div class="absolute inset-x-0 bottom-space-3 z-3 flex justify-center ps-(--st-shell-inset-left)">
      <div
        class="flex items-center gap-space-2 p-space-1 font-ui ${TRAY}"
        role="toolbar"
        aria-label="${SKETCHES_LABELS.toolbar}"
        data-sk-toolbar
      >
        ${control(header.comment, 'comment')}${control(add, 'note-add')}
      </div>
    </div>
    ${zoom}
  </div>`;

export default definePart<FlowProps>({
  note: 'Flows as a canvas with a page header: a flat list of the flows in the side panel, the open flow name as the header title with the size picker at its right end, the page actions Kommentar and Notiz as icon buttons in the shared toolbar at the bottom centre (the header has no buttons), and the flow as a graph on a canvas with the sketch camera (pan by wheel and drag, zoom with the zoom chip in the corner; a flow starts at 100 % with its first frame at the left edge, below the header): frames in columns along the lines, a branch on its own row, every line an elbow arrow with its label above the last segment. A free note is a bordered card with a shadow at its own canvas point; the whole card drags, a close button deletes it, a new note opens with an empty field. The Notiz button in the toolbar adds one.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6', 'design check'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/flows-page/flows-page.component.ts' },
  states: {
    flow: { flow: 'open' },
    'new-note': { flow: 'open', notes: true },
    orphaned: { flow: 'open', orphans: true },
    empty: { flow: 'none' },
    'comment-mode': { flow: 'open', commentMode: true },
    comments: { flow: 'open', comments: true },
    thread: { flow: 'open', comments: true, thread: true },
    'comment-draft': { flow: 'open', commentMode: true, draft: '' },
    'comments-draft': { flow: 'open', comments: true, commentMode: true, draft: 'Hier fehlt der Rückweg.' },
  },
  describe: {
    flow: 'An open flow on the canvas with a free note beside the branch; check the flow list with the open one marked, its name in the header with the size picker, the toolbar at the bottom centre with Kommentar and Notiz, the note with its delete button and the zoom chip in the corner.',
    'new-note':
      'The open flow after Notiz: the written note and a new one with its empty field; check the placeholder and the delete button on each note.',
    orphaned:
      'Zwei Notizen liegen weit vom Graphen entfernt und stehen in der Liste der verwaisten Notizen; prüfe die Einträge und ihre Lage.',
    empty:
      'A product without flows; check the empty side panel and the centred card with its copy button on the empty canvas.',
    'comment-mode':
      'Comment mode on an open flow; check the pressed Kommentar icon button in the toolbar, the Esc or C hint in the header and the faint accent wash over every frame.',
    comments:
      'A comment pin on one frame; check that it sits on its point in the shot, above the frame, and not on the other frames.',
    thread:
      'Der Faden eines Pins auf der Flow-Fläche; prüfe, dass die Karte rechts neben dem Pin auf dessen Höhe sitzt, mit Ort, Erledigen, Schließen, den Nachrichten und dem Antwortfeld.',
    'comment-draft':
      'An empty comment draft on a frame; check the text field, Abbrechen and Senden at the clicked point, and no hint beside the button.',
    'comments-draft': 'A typed draft beside an existing pin; check that the draft card does not cover the pin.',
  },
  controls: {
    canvas: { kind: 'field', part: 'components/canvas-viewport' },
    'note-add': { kind: 'button', part: 'components/button' },
    'note-delete': { kind: 'button', part: 'components/button' },
    'note-jump': { kind: 'button', part: 'components/button' },
    comment: { kind: 'button', part: 'components/button' },
    'comment-cancel': { kind: 'button', part: 'components/button' },
    'comment-send': { kind: 'button', part: 'components/button' },
    'comment-target': { kind: 'button', part: 'components/comment-target' },
  },
  render: async ({
    flow,
    notes = false,
    orphans = false,
    commentMode = false,
    comments = false,
    thread = false,
    draft,
  }) => {
    const picker = await presetPickerOf();
    const copy = await copyButton();
    const add = await addNoteButton();
    const remove = await noteDeleteButton();
    const field = await noteField('new');
    const zoom = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });
    const list = await flatFlowList();
    const menu = await studioMenu({ open: false });
    const entries = orphans ? await orphanButtons() : [];
    const drawnNotes = [
      ...(notes ? FLOW_NOTES : FLOW_NOTES.filter((note) => note.text)),
      ...(orphans ? ORPHAN_NOTES : []),
    ]
      .map((note) => noteOf(note, remove.body, field.body))
      .join('');
    const card = thread
      ? await threadCard({
          place: `${FLOW_THREAD.part} › ${FLOW_THREAD.state}`,
          messages: FLOW_MESSAGES,
          closeTo: 'comments',
        })
      : undefined;
    const comment = await commentToggleButton({ on: commentMode, action: 'emit:commentToggle' });
    const hint = commentMode && draft === undefined ? commentModeHint() : undefined;
    const written = draft === undefined ? undefined : await commentDraftAt('left-0 top-0', { text: draft });
    const onShot =
      commentMode || comments
        ? (id: string, shot: { scale: number }) =>
            html`${commentMode ? `<div class="absolute inset-0">${commentLayer(id, 'emit:pointPick')}</div>` : ''}${
              comments && id === COMMENTED
                ? placedAt(
                    COMMENT_POINT,
                    shot.scale,
                    commentPins([{ ...FLOW_THREAD, at: 'left-0 top-0' }], thread ? 0 : -1),
                  )
                : ''
            }${comments && id === COMMENTED && card ? placedAt(COMMENT_POINT, shot.scale, `<div class="absolute" style="left:calc(var(--space-6) + var(--space-3));top:calc(var(--space-6) * -1)">${card.body}</div>`) : ''}${id === COMMENTED && written ? placedAt(DRAFT_POINT, shot.scale, written.body) : ''}`
        : undefined;
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Flows',
      product: 'farn',
      side: flow === 'open' ? list.body + orphanSection(entries.map((entry) => entry.body)) : emptySide,
      content:
        flow === 'open'
          ? contentOf(
              picker.body,
              zoom.body,
              add.body,
              drawnNotes,
              { comment: comment.body, hint: hint?.body ?? '' },
              onShot,
            )
          : emptyCanvasOf(copy.body),
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles:
        shell.styles +
        menu.styles +
        list.styles +
        picker.styles +
        copy.styles +
        zoom.styles +
        add.styles +
        comment.styles +
        (written?.styles ?? '') +
        (card ? card.styles + commentRowStyles : '') +
        (hint?.styles ?? '') +
        remove.styles +
        field.styles +
        entries.map((entry) => entry.styles).join('') +
        canvasViewportStyles,
    });
  },
});
