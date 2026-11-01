import { definePart, drawing, html, ng, slot } from '@design-system';
import { control } from '@ethlete/components/design/control';
import anchoredDialog from '@system/components/anchored-dialog';
import { commentPinMark } from '@system/components/comment-pin';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';
import { icon } from '@system/foundations/icons';
import styles from './inbox.css?inline';

type Props = {
  showResolved: boolean;
  openOn: 'all' | 'active' | 'others' | 'none';
  draft?: boolean;
  entry?: boolean;
  load?: 'loading' | 'error';
  comments?: Comment[];
};

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

const MORE: [string, string, Agent | undefined, string, string, string, string][] = [
  [
    'Claude',
    'C',
    'claude',
    'Mo',
    'card',
    'elevated',
    'Der Schatten von elevated liegt jetzt auf derselben Stufe wie beim Menü.',
  ],
  [
    'Lena Krüger',
    'LK',
    undefined,
    'Mo',
    'tabs',
    'overflow',
    'QC: Die Pfeile verdecken den letzten Tab halb. Lieber ausblenden?',
  ],
  [
    'Codex',
    'CX',
    'codex',
    'So',
    'dialog',
    'open',
    'Der Fokus springt beim Öffnen auf Schließen statt auf das erste Feld.',
  ],
  ['Gemini', 'G', 'gemini', 'So', 'tooltip', 'top', 'Der Pfeil sitzt einen Pixel neben der Mitte des Ankers.'],
  ['Tom Bornholdt', 'TB', undefined, 'Sa', 'chip', 'removable', 'Das Schließen-Icon ist zu klein für den Daumen.'],
  [
    'Claude',
    'C',
    'claude',
    'Sa',
    'pagination',
    'compact',
    'Die Seitenzahl bricht bei drei Stellen um. Ich setze tabular-nums.',
  ],
  [
    'Lena Krüger',
    'LK',
    undefined,
    'Fr',
    'table',
    'sticky-header',
    'QC: Der Kopf verliert beim Scrollen seine untere Linie.',
  ],
  ['Codex', 'CX', 'codex', 'Fr', 'slider', 'range', 'Beide Griffe lassen sich übereinander ziehen. Soll das gehen?'],
  ['Tom Bornholdt', 'TB', undefined, 'Do', 'badge', 'dot', 'Der Punkt ist neben der Schrift kaum zu sehen.'],
  [
    'Gemini',
    'G',
    'gemini',
    'Do',
    'accordion',
    'open',
    'Die Öffnen-Bewegung ist eine Spur zu lang. Runde 2 zeigt 150 ms.',
  ],
];

const LONG: Comment[] = [
  ...COMMENTS,
  ...MORE.map(([author, initials, agent, when, part, state, text], index): Comment => ({
    id: `m${index + 1}`,
    author,
    initials,
    ...(agent ? { agent } : {}),
    when,
    part,
    state,
    text,
    replies: index % 3,
  })),
];

const SELECTED = 'c1';
const ACTIVE_PART = 'button';

const replyIcon = icon('reply', { size: 14, cls: 'flex-none' });
const checkIcon = icon('check', { size: 14, cls: 'flex-none' });

const countClass = 'flex items-center gap-0.5 text-et-surface-muted';

const row = (c: Comment) => {
  const selected = c.id === SELECTED;
  const strong = c.resolved ? 'text-et-surface-muted' : 'text-et-surface';

  return html`<div
    class="flex gap-space-2 p-space-2 rounded-control-md cursor-pointer ${selected ? 'bg-et-theme/20' : ''}"
    data-et-control="row"
  >
    <span
      class="ib-avatar flex flex-none items-center justify-center size-5 bg-et-surface-bg text-et-surface text-(length:--text-xs) font-ui-strong"
      data-et-auto-surface
      >${c.agent ? agentLogo(c.agent, 'size-3') : c.initials}</span
    >
    <div class="flex flex-1 flex-col gap-0.5 min-w-0">
      <div class="flex items-center gap-space-1 text-ui-xs whitespace-nowrap">
        <span class="${strong} font-ui-medium">${c.author}</span>
        <span class="flex-1 text-et-surface-muted">${c.when}</span>
        ${c.unread ? '<span class="ib-unread size-1.5 bg-et-theme" title="Ungelesen"></span>' : ''}
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

const groupHead = (title: string, count: number) =>
  `<div class="flex items-center justify-between pt-space-3 px-space-2 pb-space-1 not-first:mt-space-2 not-first:border-t border-et-surface-border text-et-surface-muted text-(length:--text-xs)"><span class="font-code">${title}</span><span>${count}</span></div>`;

const group = (title: string, comments: Comment[]) =>
  comments.length === 0 ? '' : groupHead(title, comments.length) + comments.map(row).join('');

const activeGroup = (comments: Comment[]) =>
  comments.length === 0
    ? `${groupHead(ACTIVE_PART, 0)}<p class="m-0 pt-space-1 px-space-2 pb-space-2 text-et-surface-muted text-(length:--text-sm)">Keine offenen Kommentare zu ${ACTIVE_PART}.</p>`
    : group(ACTIVE_PART, comments);

const empty = `<div class="flex flex-col items-center gap-space-1 py-space-7 px-space-4 text-center">${icon('check', { size: 14, cls: 'size-5 mb-space-2 text-et-theme-ink' })}<p class="m-0 text-et-surface text-(length:--text-sm)">Keine offenen Kommentare</p><p class="m-0 text-et-surface-muted text-(length:--text-xs)">Kommentare von dir, deinem Agenten und dem Team erscheinen hier.</p></div>`;

const loadingNote = `<p class="m-0 px-space-2 pt-space-1 text-et-surface-muted text-(length:--text-sm)">Kommentare werden geladen…</p>`;

const loadError = (retry: string) =>
  `<div class="flex flex-col items-center gap-space-1 py-space-7 px-space-4 text-center"><span class="contents" data-et-semantic-color="error">${icon('error', { size: 14, cls: 'size-5 mb-space-2 text-et-theme' })}</span><p class="m-0 text-et-surface text-(length:--text-sm)">Kommentare nicht geladen</p><p class="m-0 text-et-surface-muted text-(length:--text-xs)">Die Liste kam nicht vom Design-Server an.</p><div class="mt-space-3">${retry}</div></div>`;

const pinned = (body: string, comments: Comment[], pin: (c: Comment) => string) => {
  let index = -1;
  return body.replace(/<div class="(st-sgrid-cell[^"]*)">/gu, (match, cls: string) => {
    index += 1;
    const c = comments.find((comment) => comment.cell === index);
    if (!c) return match;
    return `<div class="${cls} relative"><span class="absolute -top-3.5 right-1.5 z-11 flex">${pin(c)}</span>`;
  });
};

const open: Props = { showResolved: false, openOn: 'all' };
const withResolved: Props = { showResolved: true, openOn: 'all' };
const activeOnly: Props = { showResolved: false, openOn: 'active' };
const activeClear: Props = { showResolved: false, openOn: 'others' };
const allClear: Props = { showResolved: false, openOn: 'none' };

export const inbox = () =>
  definePart<Props>({
    note: 'Inbox, flat: every thread of the product, newest first, in two groups: the part on the canvas on top, all others below, showing its latest message: mostly the exchange between the user and their AI agent (Claude, Codex and Gemini in this sample), plus a teammate QC pass. Each row has the author, the part and state it sits on, and a reply count. The canvas shows the frame of the selected comment with its pin. States cover open comments only on the active part, an active part with no open comments, no open comments at all, the list while it loads, a load error with a retry, and a list longer than the panel, which scrolls. The comment editor is open only while focus is within it; moving focus between its controls keeps it open, and leaving the editor closes it.',
    madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
    states: {
      open,
      'with-resolved': withResolved,
      'active-only': activeOnly,
      'active-clear': activeClear,
      'all-clear': allClear,
      'comment-draft': { ...open, draft: true },
      'comment-entry': { ...open, entry: true },
      loading: { ...open, load: 'loading' },
      'load-error': { ...open, load: 'error' },
      'long-list': { ...open, comments: LONG },
    },
    controls: {
      pin: { kind: 'button' as const, part: 'components/comment-pin' },
      comment: { kind: 'field' as const, part: 'components/textarea' },
      send: { kind: 'button' as const, part: 'components/button' },
      resolved: { kind: 'button' as const, part: 'components/switch' },
      row: { kind: 'row' as const, input: ['pointer' as const] },
      retry: { kind: 'button' as const, part: 'components/button' },
    },
    render: async ({ showResolved, openOn, draft, entry, load, comments: list = COMMENTS }) => {
      const controls = await ng(
        `<span class="ib-control inline-flex">${control(`<et-switch [checked]="${showResolved}" aria-label="Erledigte zeigen" />`, 'resolved')}</span>`,
        { imports: ['SWITCH_IMPORTS'] },
      );
      const dialog =
        draft || entry
          ? await anchoredDialog.render({
              label: 'Kommentar',
              modal: false,
              placement: 'bottom-start',
              content: await ng(
                `<div class="box-border flex flex-col items-stretch w-80 p-3"><et-textarea data-et-control="comment" class="flex-1 min-w-0" aria-label="Kommentar" placeholder="Kommentar hinzufügen" rows="${draft ? '3' : '1'}" resize="none" ${draft ? 'value="Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist."' : ''} /><button et-button data-et-control="send" type="button" variant="transparent" color="surface" size="xs" ${draft ? 'class="self-end"' : 'disabled class="self-end text-et-surface-muted [--et-button-opacity-disabled:1]"'}>Senden</button></div>`,
                { imports: ['TEXTAREA_IMPORTS', 'BUTTON_IMPORTS'] },
              ),
            })
          : null;
      const editor = dialog
        ? html`<div class="fixed top-46.75 left-152.25 w-80 z-10 text-ui-sm">
            ${commentPinMark({ author: 'Tom Bornholdt', initials: 'TB', selected: true }).replace(/^<button\s/u, '<button data-et-control="pin" ')}
            <div class="mt-1.25">${dialog.body}</div>
          </div>`
        : '';
      const retry = await ng(
        control(
          `<button et-button type="button" variant="outline" color="surface" size="sm">Erneut laden</button>`,
          'retry',
        ),
        { imports: ['BUTTON_IMPORTS'] },
      );
      const comments = (load ? [] : list).filter(
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
      const side = html`<div class="ib flex flex-col -m-space-2">
        <div
          class="flex items-center justify-between gap-space-2 h-9 flex-none px-space-3 border-b border-et-surface-border text-ui-sm"
        >
          <span class="text-et-surface-muted">${load ? '' : `${unresolved} offen`}</span>
          <div class="flex items-center gap-space-2 text-et-surface">Erledigte zeigen ${controls}${editor}</div>
        </div>
        <div class="flex flex-col gap-px min-h-0 overflow-auto p-space-2">
          ${load === 'loading' ? loadingNote : load === 'error' ? loadError(retry) : visible.length === 0 ? empty : activeGroup(visible.filter((c) => c.part === ACTIVE_PART))}${group(
            'Andere',
            visible.filter((c) => c.part !== ACTIVE_PART),
          )}
        </div>
      </div>`;
      const menu = await studioMenu({ open: false });
      const shell = await shellMain.render({
        studio: menu.body,
        section: 'Inbox',
        product: 'studio',
        side,
        content: `<div class="contents" ${slot('canvas')}>${pinned(
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
          (c) => (c.id === 'draft' ? '' : (pins.get(c.id) ?? '')),
        )}</div>`,
      });

      return drawing({
        body: shell.body,
        setup: menu.setup,
        styles: shell.styles + menu.styles + frames.styles + (dialog?.styles ?? '') + styles,
      });
    },
  });
