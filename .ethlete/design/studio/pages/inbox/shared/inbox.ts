import { definePart, drawing, html, ng, svgAsset } from '@design-system';
import commentPin, { commentPinMark } from '@system/components/comment-pin';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';
import styles from './inbox.css?inline';

type Props = { showResolved: boolean; openOn: 'all' | 'active' | 'others' | 'none'; draft?: boolean; entry?: boolean };

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

const open: Props = { showResolved: false, openOn: 'all' };
const withResolved: Props = { showResolved: true, openOn: 'all' };
const activeOnly: Props = { showResolved: false, openOn: 'active' };
const activeClear: Props = { showResolved: false, openOn: 'others' };
const allClear: Props = { showResolved: false, openOn: 'none' };

export const inbox = (
  compact: boolean,
  placement: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l',
  sendIcon = '',
) =>
  definePart<Props>({
    note: 'Inbox, flat: every thread of the product, newest first, in two groups: the part on the canvas on top, all others below, showing its latest message: mostly the exchange between the user and their AI agent (Claude, Codex and Gemini in this sample), plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin. States cover open comments only on the active part, an active part with no open comments, and no open comments at all.',
    madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
    states: {
      open,
      'with-resolved': withResolved,
      'active-only': activeOnly,
      'active-clear': activeClear,
      'all-clear': allClear,
      'comment-draft': { ...open, draft: true },
      ...(['i', 'j', 'k', 'l'].includes(placement) ? { 'comment-entry': { ...open, entry: true } } : {}),
    },
    render: async ({ showResolved, openOn, draft, entry }) => {
      const controls = await ng(
        `<div class="ib-controls" data-placement="${placement}">
        <span class="ib-control${compact ? ' ib-control-compact' : ''}"><et-switch [checked]="${showResolved}" aria-label="Erledigte zeigen" /></span>
        ${
          (draft || entry) && (placement === 'k' || placement === 'l')
            ? `<div class="ib-draft ib-studio-compose z-10 text-ui-sm" data-compose="${placement}">
                ${commentPinMark({ author: 'Tom Bornholdt', initials: 'TB', selected: true })}
                <div class="ib-studio-paper ${placement === 'l' ? 'rounded-md border border-surface-border shadow-lg' : ''} bg-surface">
                  <div class="ib-studio-writing"><et-textarea aria-label="Kommentar" placeholder="Kommentar hinzufügen" rows="${draft ? '3' : '1'}" resize="none" ${draft ? 'value="Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist."' : ''} /><button et-button type="button" variant="transparent" color="surface" size="xs" ${draft ? '' : 'disabled class="text-text-muted [--et-button-opacity-disabled:1]"'}>Senden</button></div>
                </div>
              </div>`
            : (draft || entry) && (placement === 'i' || placement === 'j')
              ? `<div class="ib-draft ib-entry z-10 flex items-start ${placement === 'i' ? 'gap-2' : 'gap-0'} text-ui-sm">
                ${commentPinMark({ author: 'Tom Bornholdt', initials: 'TB', selected: true })}
                <div class="flex min-w-0 flex-1 items-end gap-2 rounded-md border border-surface-border bg-surface px-3 py-2 shadow-lg">
                  <et-textarea aria-label="Kommentar" placeholder="Kommentar hinzufügen" rows="${draft ? '3' : '1'}" resize="none" ${draft ? 'value="Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist."' : ''} />
                  <button et-icon-button type="button" variant="filled" ${draft ? '' : 'color="surface" disabled class="bg-text-muted text-surface [--et-button-opacity-disabled:1]"'} size="xs" aria-label="Senden">${svgAsset(sendIcon, { size: 16, attrs: { etIcon: '', 'aria-hidden': 'true' } })}</button>
                </div>
              </div>`
              : draft
                ? placement === 'g' || placement === 'h'
                  ? `<div class="ib-draft ib-composition z-10 text-ui-sm" data-composition="${placement}">
                ${placement === 'g' ? `<div class="ib-composition-avatar">${commentPinMark({ author: 'Tom Bornholdt', initials: 'TB', selected: true })}</div>` : ''}
                <div class="min-w-0 flex-1 rounded-md border border-surface-border bg-surface p-3 shadow-lg">
                  ${placement === 'h' ? `<div class="mb-2 flex items-center gap-2 font-ui-medium">${commentPinMark({ author: 'Tom Bornholdt', initials: 'TB', selected: true })}<span>Tom Bornholdt</span></div>` : ''}
                  <et-form-field appearance="box"><et-textarea aria-label="Kommentar" rows="3" value="Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist." /></et-form-field>
                  <div class="mt-2 flex items-center justify-end gap-1"><button et-button type="button" variant="transparent" color="surface" size="xs">Abbrechen</button><button et-button type="button" variant="filled" size="xs">Senden</button></div>
                </div>
              </div>`
                  : `<div class="ib-draft z-10 rounded-md border border-surface-border bg-surface p-3 ${placement === 'e' ? 'pt-8' : ''} text-ui-sm shadow-lg"><div class="mb-2 flex justify-between gap-2 font-ui-medium">Neuer Kommentar <span class="font-code text-ui-xs font-normal text-text-muted">button › tonal · rest</span></div>
          <et-form-field appearance="box"><et-textarea aria-label="Kommentar" rows="3" value="Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist." /></et-form-field>
          <div class="mt-2 flex flex-wrap items-center justify-end gap-1"><span class="min-w-0 flex-1 text-ui-xs text-text-muted">Enter sendet · Shift + Enter für Zeilenumbruch</span><button et-button type="button" variant="transparent" color="surface" size="xs">Abbrechen</button><button et-button type="button" variant="filled" size="xs">Senden</button></div>
        </div>`
                : ''
        }</div>`,
        {
          imports: ['SWITCH_IMPORTS', 'FORM_FIELD_IMPORTS', 'TEXTAREA_IMPORTS', 'BUTTON_IMPORTS'],
        },
      );
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
          <div class="ib-toggle">Erledigte zeigen ${controls}</div>
        </div>
        <div class="ib-list${draft && placement === 'b' ? ' ib-list-draft' : ''}">
          ${visible.length === 0 ? empty : activeGroup(visible.filter((c) => c.part === ACTIVE_PART))}${group(
            'Andere',
            visible.filter((c) => c.part !== ACTIVE_PART),
          )}
        </div>
        ${draft && placement === 'b' ? '<div class="ib-draft-space"></div>' : ''}
      </div>`;
      const shell = await shellMain.render({
        section: 'Inbox',
        product: 'studio',
        side,
        content: pinned(
          frames.body,
          draft || entry
            ? visible
                .filter((c) => c.cell !== 12)
                .concat({
                  id: 'draft',
                  author: 'Tom Bornholdt',
                  initials: 'TB',
                  when: '',
                  part: 'button',
                  state: 'tonal · rest',
                  text: '',
                  replies: 0,
                  cell: 12,
                })
            : visible,
          (c) =>
            c.id === 'draft'
              ? ['g', 'h', 'i', 'j', 'k', 'l'].includes(placement)
                ? ''
                : commentPinMark({ author: c.author, initials: c.initials, selected: true })
              : (pins.get(c.id) ?? ''),
        ),
      });

      return drawing({
        body: shell.body,
        styles: shell.styles + frames.styles + commentPin.styles + styles,
      });
    },
  });
