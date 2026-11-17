import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, slot, withAction } from '@design-system';
import anchoredDialog from '@system/components/anchored-dialog';
import button from '@system/components/button';
import { canvasFrame, canvasFrameStyles, canvasView, stateGrid } from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import { manyStatesView, treeRowGrid } from './shared/many-states';
import { FOLDED_SAMPLE, foldedStatesPill } from './shared/folded-states';
import disclosureStyles from '@system/components/disclosure.css?inline';
import { icon, type IconName } from '@system/foundations/icons';
import {
  buttonPoints,
  checkIcon,
  collapsed,
  groupsOf,
  nothingOpen,
  type PartOpenPoints,
  type PointGroup,
} from './shared/open-points';
import { buttonExceptions, callView, exceptionRows } from './shared/capabilities';
import {
  agentOnReadyPart,
  agentSamples,
  directEditBlocker,
  embeddedBlocker,
  manyBlockers,
  slowRules,
  hardcodedColourBlocker,
  type AgentProgress,
  type AgentState,
  type BuildReady,
} from './shared/build-ready';
import { buildReadyView } from './build-ready-footer';
import {
  commentButton,
  commentDraftAt,
  commentLayer,
  commentList,
  commentPins,
  draftPin,
  type PlacedThread,
  withCommentList,
} from '@system/components/comment-flow';

const ghostBox = '<span class="block w-15 h-10 rounded-sm outline outline-et-surface-border bg-et-surface-bg"></span>';

const emptyCanvasOf = (copy: string) =>
  html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
    <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
      <div class="grid grid-cols-2 gap-space-2" aria-hidden="true">${ghostBox}${ghostBox}${ghostBox}${ghostBox}</div>
      <p class="m-0 text-et-surface font-ui-strong text-ui-md">Noch keine Teile</p>
      <p class="m-0 text-et-surface-muted">
        Das Design-System eines Produkts wächst in Schichten: Foundations, Components, Elements und Pages. Dein Agent
        zeichnet jeden Teil als Sketch, du wählst unter Sketches. Bitte ihn zum Beispiel so:
      </p>
      <p class="m-0 p-space-3 rounded-(--radius-control-md) bg-et-surface-bg text-et-surface text-ui-sm">
        Lege die Foundations für studio an: Farben, Schrift und Abstände.
      </p>
      ${withAction(copy, 'emit:copyPrompt')}
    </div>
  </div>`;

const chip = async (open: PartOpenPoints, pressed: boolean, acting: boolean, exceptions: number) => {
  const count = open.points.length + exceptions;
  const drawn = await button.render(
    {
      label: count ? `${count} offen` : 'Nichts offen',
      icon: count
        ? `<span class="contents" data-et-semantic-color="warning">${icon('warning', { size: 14, cls: 'text-et-theme' })}</span>`
        : checkIcon(14),
      variant: 'outline',
      size: 'sm',
      pressed,
    },
    {},
  );
  const target = pressed ? 'points-closed' : 'part';
  return {
    body: control(acting ? withAction(drawn.body, target) : drawn.body, 'open-points'),
    styles: drawn.styles,
  };
};

const PART_THREADS: PlacedThread[] = [
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

const DRAFT_AT = 'left-[38%] top-[42%]';

type SendPhase = 'busy' | 'error' | 'rejected';

const REFUSED = 'part components/button no longer exists';

const kindIcon = (name: IconName) => icon(name, { size: 14, cls: 'flex-none text-(--et-surface-color-muted-solid)' });

const pointLines = ({ icon: name, lines }: PointGroup) => {
  const { shown, more } = collapsed(lines, 3);
  return (
    shown
      .map(
        ({ text, detail }) =>
          html`<li class="flex items-center gap-space-2 px-space-3 py-space-1">
            ${kindIcon(name)}<span class="flex-1 min-w-0 truncate text-(--et-surface-color-solid)">${text}</span
            ><span class="font-code text-(--et-surface-color-muted-solid) text-ui-xs">${detail}</span>
          </li>`,
      )
      .join('') +
    (more > 0
      ? html`<li class="ps-9 pe-space-3 py-space-1 text-(--et-surface-color-muted-solid)">+${more} weitere</li>`
      : '')
  );
};

const exceptionGroup = async () => {
  const rows = await exceptionRows(buttonExceptions);
  return {
    body: html`<section class="border-t border-(--et-surface-border-solid) py-space-1">
      <h3
        class="m-0 flex items-center gap-space-2 px-space-3 py-space-1 text-ui-xs font-ui-strong text-et-surface-muted"
      >
        Ausnahmen<span class="font-code font-normal">${buttonExceptions.length}</span>
      </h3>
      ${rows.body}
    </section>`,
    styles: rows.styles,
  };
};

const popover = async (
  open: PartOpenPoints,
  status: BuildReady,
  agent: AgentProgress | undefined,
  withExceptions: boolean,
  blockersOpen: boolean,
) => {
  const groups = groupsOf(open);
  const exceptions = withExceptions ? await exceptionGroup() : undefined;
  const build = await buildReadyView(status, agent, blockersOpen);
  const list = groups.length
    ? html`<ul class="m-0 p-0 py-space-1 list-none divide-y divide-(--et-surface-border-solid)">
        ${groups.map((group) => `<li><ul class="m-0 p-0 py-space-1 list-none">${pointLines(group)}</ul></li>`).join('')}
      </ul>`
    : html`<div class="flex items-center gap-space-2 px-space-3 py-space-4">
        ${checkIcon()}<span class="text-(--et-surface-color-muted-solid)"
          >Jeder Zustand ist gezeichnet, verknüpft und besprochen.</span
        >
      </div>`;
  const dialog = await anchoredDialog.render({
    label: 'Offene Punkte',
    modal: false,
    anchor: '[data-et-control="open-points"]',
    content: html`<div class="w-96 text-ui-sm">
      <header
        class="flex items-baseline gap-space-2 px-space-3 pt-space-3 pb-space-2 border-b border-(--et-surface-border-solid)"
      >
        <span class="text-(--et-surface-color-solid) font-ui-strong"
          >${groups.length ? 'Offene Punkte' : 'Nichts offen'}</span
        >
        <span class="ms-auto font-code text-(--et-surface-color-muted-solid) text-ui-xs">${open.part}</span>
      </header>
      ${build.before}${list}${exceptions?.body ?? ''}${build.footer}
    </div>`,
  });
  return {
    body: html`<div class="absolute top-full right-0 mt-2.5" style="transform: translate3d(0, 0, 0)">
      ${dialog.body}
    </div>`,
    styles: dialog.styles + (exceptions?.styles ?? '') + build.styles,
  };
};

const TYPED = 'Der Abstand unter der Kopfzeile wirkt zu knapp.';

const FIT_PADDING = 64;

const insetOf = (canvas: HTMLElement) => {
  const probe = document.createElement('div');

  probe.style.width = 'var(--st-shell-inset-left, 0px)';
  canvas.append(probe);

  const inset = probe.offsetWidth;

  probe.remove();

  return inset;
};

const fitAll = (root: HTMLElement) => {
  const canvas = root.querySelector<HTMLElement>('.st-canvas');
  const strip = canvas?.firstElementChild as HTMLElement | null;
  const frame = strip?.querySelector<HTMLElement>('.st-cframe');

  if (!canvas || !strip || !frame) return;

  const width = canvas.clientWidth - insetOf(canvas);
  const height = canvas.clientHeight;
  const zoom = Math.min(
    1,
    (width - FIT_PADDING * 2) / frame.offsetWidth,
    (height - FIT_PADDING * 2) / frame.offsetHeight,
  );
  const left = (width - frame.offsetWidth * zoom) / 2;
  const top = Math.min((height - frame.offsetHeight * zoom) / 2, FIT_PADDING);
  const frameLeft = frame.offsetLeft - strip.offsetLeft;
  const frameTop = frame.offsetTop - strip.offsetTop;

  strip.style.transformOrigin = '0 0';
  strip.style.transform = `translate(${left - frameLeft * zoom}px, ${top - frameTop * zoom}px) scale(${zoom})`;
};

const interactions = ['rest', 'hover', 'active', 'focus-visible', 'pressed', 'disabled'] as const;

const BUTTON_SENTENCES = {
  filled:
    'The filled button in every interaction; check that hover and active darken the fill and the pressed one stays dark.',
  outline:
    'The outlined button in every interaction; check that the border stays visible on hover and disabled fades it.',
  tonal:
    'The tonal button in every interaction; check that the tint deepens on hover and the label keeps its contrast.',
};

const buttonGrid = async () => {
  const rows = await Promise.all(
    (['filled', 'outline', 'tonal'] as const).map(async (variant) => ({
      label: variant,
      description: BUTTON_SENTENCES[variant],
      cells: await Promise.all(
        interactions.map(async (interaction) => {
          const props = { label: 'Save', variant, pressed: interaction === 'pressed' };
          const forced = interaction === 'rest' || interaction === 'pressed' ? {} : { interaction };
          return (await button.render(props, forced)).body;
        }),
      ),
    })),
  );
  return stateGrid({ columns: [...interactions], rows }, { cellWidth: '120px', place: 'center' });
};

const emptySide = html`<p class="px-space-3 py-space-2 text-et-surface-muted text-ui-sm">Noch keine Teile.</p>`;

const CANVAS_NOTE = 'Starte den Design-Server, um das Design-System zu sehen.';

export default definePart<{
  empty?: boolean;
  listingError?: boolean;
  noted?: boolean;
  manyStates?: boolean;
  folded?: boolean;
  nothingOpen?: boolean;
  closed?: boolean;
  fit?: boolean;
  commentMode?: boolean;
  comments?: boolean;
  draft?: string;
  send?: SendPhase;
  reason?: string;
  build?: 'one-blocker' | 'checking' | 'blocked-checking' | 'direct-edit';
  blockersOpen?: boolean;
  agent?: AgentState;
  call?: 'open' | 'transferred';
}>({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas. A product without parts shows a short line in the panel and a centred card on the canvas, the same card as the empty Flows page: a ghost of four boxes, a title, what the layers are, an example prompt for the agent and a copy button. Top right, beside the open-points chip, the Kommentar toggle turns comment mode on: each frame becomes a crosshair target, and a click opens a draft at that point with a text field, Abbrechen and Senden. While a comment is sent, the field and Abbrechen are disabled and Senden shows a spinner; a failed send keeps the text: a network or server error shows "Kommentar nicht gesendet. Erneut versuchen." under the field and turns Senden into Erneut senden; a send the server refuses with a 4xx shows the server reason there and keeps Senden, with no retry. The open-points popover also lists the exceptions of the part as an Ausnahmen group, each with its reason, state and a Freigeben button, and ends in a footer with the computed build-ready status as a badge (Baubereit, Nicht baubereit (n) in the warning colour, Wird geprüft only while slow rules run and no blocker is definite: as soon as one blocker is definite the badge reads Nicht baubereit, even while a slow rule still runs, ADR 0270) and, beside it, the progress of the agent as a second badge (Agent behebt, Agent wartet, Agent unterbrochen, Agent fehlgeschlagen in the error colour, the detail as its title); Gründe opens the blockers grouped by kind, and a direct edit offers Sketch öffnen; the chip counts the exceptions with the points. A failed listing read shows an error card centred in the canvas, like the empty-product card: a small error icon, the title Auflistung fehlgeschlagen, the server reason as the muted line, for example "missing build: pages/system", and an Erneut laden button; the tree is empty and there are no frames and no open-points chip. Steht statt eines Teils ein Hinweis auf der Fläche (Design-Server nicht gestartet, Lesefehler, Sketch nicht gefunden), zeigt sie eine Karte wie die leere Seite: ein Icon, ein kurzer Titel und darunter der Hinweis; keine Rahmen, kein Chip, keine Kommentar-Taste. A legacy call shows a header with its slug and headline, the surface and colour theme switches, and Als übertragen markieren, which turns into an übertragen badge. A part with 12 or more states opens on the states with an open comment and folds the rest behind a pill at the bottom centre of the canvas: "13 weitere Zustände eingeklappt" and the disclosure Alle Zustände zeigen, which shows every state and leaves only the disclosure, open, in the pill. When no state or every state has an open comment, nothing folds.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6', 'design check'],
  implements: {
    route: '/',
    component: 'apps/ethlete-studio/src/app/design-parts/system-page/system-page.component.ts',
  },
  states: {
    part: {},
    empty: { empty: true },
    'listing-error': { listingError: true },
    'canvas-note': { noted: true },
    'many-states': { manyStates: true },
    'many-states-folded': { closed: true, comments: true, folded: true },
    fit: { fit: true },
    'points-closed': { closed: true },
    'nothing-open': { nothingOpen: true },
    'comment-mode': { closed: true, commentMode: true },
    'comment-draft': { closed: true, commentMode: true, draft: '' },
    'comment-draft-typed': {
      closed: true,
      commentMode: true,
      draft: TYPED,
    },
    'send-busy': {
      closed: true,
      commentMode: true,
      draft: TYPED,
      send: 'busy',
    },
    'send-error': {
      closed: true,
      commentMode: true,
      draft: TYPED,
      send: 'error',
    },
    'send-rejected': {
      closed: true,
      commentMode: true,
      draft: TYPED,
      send: 'rejected',
      reason: REFUSED,
    },
    comments: { closed: true, comments: true },
    'comments-mode': { closed: true, comments: true, commentMode: true },
    'comments-draft': { closed: true, comments: true, commentMode: true, draft: TYPED },
    'one-blocker': { nothingOpen: true, build: 'one-blocker' },
    checking: { nothingOpen: true, build: 'checking' },
    'blocked-checking': { nothingOpen: true, build: 'blocked-checking' },
    'direct-edit': { build: 'direct-edit', blockersOpen: true },
    'direct-edit-closed': { build: 'direct-edit' },
    'blockers-open': { blockersOpen: true },
    'agent-working': { agent: 'working' },
    'agent-working-ready': { nothingOpen: true, agent: 'working' },
    'agent-failed': { agent: 'failed' },
    'agent-failed-ready': { nothingOpen: true, agent: 'failed' },
    'agent-waiting': { agent: 'waiting' },
    'agent-interrupted': { agent: 'interrupted' },
    call: { call: 'open' },
    'call-transferred': { call: 'transferred' },
  },
  describe: {
    part: 'The button part on the canvas with its state grid; check that each row shows its sentence under the state name.',
    empty: 'A product without parts; check the short line in the panel and the centred card with the example prompt.',
    'listing-error':
      'A failed listing read; check the centred error card with the server reason and Erneut laden, and that no frames show.',
    'canvas-note':
      'A note instead of a part; check the card with its icon, title and the hint, and that no chip or comment button shows.',
    'many-states': 'A part with many states; check that only the states with an open comment open and the rest fold.',
    'many-states-folded':
      'The folded states; check the pill at the bottom centre with the count and Alle Zustände zeigen.',
    fit: 'The canvas fitted to its frame; check that the frame sits centred with room at the top.',
    'points-closed': 'The open-points chip closed; check its count beside the Kommentar toggle.',
    'nothing-open': 'A part with no open points; check that the chip reads Nichts offen.',
    'comment-mode': 'Comment mode on; check the pressed Kommentar toggle and the crosshair over the frame.',
    'comment-draft': 'An empty comment draft; check the text field, Abbrechen and Senden at the clicked point.',
    'comment-draft-typed': 'A typed comment draft; check that the text wraps inside the field and Senden is enabled.',
    'send-busy': 'A comment being sent; check that the field and Abbrechen are disabled and Senden shows a spinner.',
    'send-error': 'A failed send; check the retry line under the field, the kept text and Erneut senden.',
    'send-rejected':
      'A send the server refused; check its reason under the field and that Senden stays without a retry.',
    comments: 'The comment pins of the part; check their numbers and where they sit on the frame.',
    'comments-mode': 'Comment pins in comment mode; check that the pins stay visible over the crosshair.',
    'comments-draft': 'A draft beside existing pins; check that the draft pin does not cover a numbered pin.',
    'one-blocker': 'One definite blocker; check that the badge reads Nicht baubereit (1) in the warning colour.',
    checking: 'Slow rules still running with no definite blocker; check that the badge reads Wird geprüft.',
    'blocked-checking':
      'A definite blocker while slow rules run; check that the badge reads Nicht baubereit, not Wird geprüft.',
    'direct-edit': 'A direct edit with the blockers open; check the grouped reasons and Sketch öffnen.',
    'direct-edit-closed': 'A direct edit with the blockers closed; check the badge and Gründe in the footer.',
    'blockers-open': 'The blockers grouped by kind; check every group heading and its entries.',
    'agent-working': 'The agent fixing open points; check the Agent behebt badge beside the build status.',
    'agent-working-ready': 'The agent working on a ready part; check that Baubereit and Agent behebt both show.',
    'agent-failed': 'The agent failed; check the Agent fehlgeschlagen badge in the error colour and its detail title.',
    'agent-failed-ready': 'The agent failed on a ready part; check that Baubereit stays beside the error badge.',
    'agent-waiting': 'The agent waiting; check the Agent wartet badge.',
    'agent-interrupted': 'The agent interrupted; check the Agent unterbrochen badge.',
    call: 'A legacy call; check the header with its slug, headline, theme switches and Als übertragen markieren.',
    'call-transferred': 'A transferred call; check the übertragen badge in place of the button.',
  },
  controls: {
    comment: { kind: 'button', part: 'components/button' },
    'comment-cancel': { kind: 'button', part: 'components/button' },
    'comment-send': { kind: 'button', part: 'components/button' },
    'comment-target': { kind: 'button', part: 'components/comment-target' },
    'open-points': { kind: 'button', part: 'components/button' },
    reload: { kind: 'button', part: 'components/button' },
    'open-edit-sketch': { kind: 'button', part: 'components/button' },
    toggle: { kind: 'disclosure', part: 'components/disclosure', surfaces: { body: 'blockers-open' } },
    'exception-approve': { kind: 'button', part: 'components/button' },
    transfer: { kind: 'button', part: 'components/button' },
    theme: { kind: 'button', part: 'components/button' },
    popover: { kind: 'disclosure', part: 'components/anchored-dialog', surfaces: { body: 'open-points' } },
  },
  render: async ({
    empty,
    listingError,
    noted,
    manyStates,
    folded = false,
    nothingOpen: clear,
    closed,
    fit,
    commentMode = false,
    comments = false,
    draft,
    send,
    reason,
    build,
    blockersOpen = false,
    agent,
    call,
  }) => {
    if (call) {
      const tree = await partTree.render(partTree.states['components-open']);
      const view = await callView(call === 'transferred');
      const menu = await studioMenu({ open: false });
      const shell = await shellMain.render({
        studio: menu.body,
        section: 'System',
        product: 'studio',
        side: tree.body,
        content: view.body,
      });

      return drawing({
        body: shell.body,
        setup: menu.setup,
        styles: shell.styles + menu.styles + tree.styles + canvasFrameStyles + view.styles,
      });
    }

    if (manyStates) {
      return manyStatesView(await treeRowGrid());
    }

    if (listingError) {
      const reload = await button.render({ label: 'Erneut laden', variant: 'outline', size: 'sm' });
      const menu = await studioMenu({ open: false });
      const shell = await shellMain.render({
        studio: menu.body,
        section: 'System',
        product: 'studio',
        side: '',
        content: html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
          <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
            <span class="contents" data-et-semantic-color="error"
              >${icon('error', { size: 24, cls: 'text-et-theme' })}</span
            >
            <p class="m-0 text-et-surface font-ui-strong text-ui-md">Auflistung fehlgeschlagen</p>
            <p class="m-0 text-et-surface-muted">missing build: pages/system</p>
            ${control(withAction(reload.body, 'emit:reload'), 'reload')}
          </div>
        </div>`,
      });

      return drawing({ body: shell.body, setup: menu.setup, styles: shell.styles + menu.styles + reload.styles });
    }

    if (noted) {
      const menu = await studioMenu({ open: false });
      const shell = await shellMain.render({
        studio: menu.body,
        section: 'System',
        product: 'studio',
        side: '',
        content: html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)" data-canvas-note>
          <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
            ${icon('warning', { size: 24, cls: 'text-et-surface-muted' })}
            <p class="m-0 text-et-surface font-ui-strong text-ui-md">Design-Server läuft nicht</p>
            <p class="m-0 text-et-surface-muted">${CANVAS_NOTE}</p>
          </div>
        </div>`,
      });

      return drawing({ body: shell.body, setup: menu.setup, styles: shell.styles + menu.styles });
    }

    if (empty) {
      const copy = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });
      const menu = await studioMenu({ open: false });
      const shell = await shellMain.render({
        studio: menu.body,
        section: 'System',
        product: 'studio',
        side: emptySide,
        content: emptyCanvasOf(copy.body),
      });

      return drawing({ body: shell.body, setup: menu.setup, styles: shell.styles + menu.styles + copy.styles });
    }

    const tree = await partTree.render(partTree.states['components-open']);
    const shot = fit
      ? html`<div class="w-md h-45" ${slot('shot')}></div>`
      : html`<div ${slot('shot')}>${await buttonGrid()}</div>`;
    const at = comments ? 'left-[calc(38%+var(--space-6))] top-[42%]' : DRAFT_AT;
    const writing = draft === undefined ? undefined : await commentDraftAt(at, { text: draft, phase: send, reason });
    const target = commentLayer('button', 'comment-draft');
    const pins = comments ? commentPins(PART_THREADS, writing ? -1 : 0) + (writing ? draftPin(DRAFT_AT) : '') : '';
    const body =
      commentMode || comments
        ? html`<div class="relative">${shot}${pins}${commentMode ? target : ''}${writing?.body ?? ''}</div>`
        : shot;
    const frames = await canvasView([canvasFrame('button', body)], '100%', {}, 'w-full', true);
    const points = clear ? nothingOpen : buttonPoints;
    const acting = !fit && !clear;
    const exceptionCount = clear ? 0 : buttonExceptions.length;
    const toggle = await chip(points, !closed, acting && !commentMode, exceptionCount);
    const comment = await commentButton({
      on: commentMode,
      ...(acting ? { action: commentMode ? 'points-closed' : 'comment-mode' } : {}),
    });
    const status: BuildReady =
      build === 'checking'
        ? { state: 'checking', rules: slowRules }
        : build === 'one-blocker'
          ? { state: 'blocked', blockers: [embeddedBlocker] }
          : build === 'blocked-checking'
            ? { state: 'blocked', blockers: [hardcodedColourBlocker] }
            : build === 'direct-edit'
              ? {
                  state: 'blocked',
                  blockers: [directEditBlocker, ...manyBlockers(points.points.length + exceptionCount)],
                }
              : clear
                ? { state: 'ready' }
                : { state: 'blocked', blockers: manyBlockers(points.points.length + exceptionCount) };
    const dialog = closed
      ? undefined
      : await popover(
          points,
          status,
          agent === undefined ? undefined : clear && agent === 'working' ? agentOnReadyPart : agentSamples[agent],
          exceptionCount > 0,
          blockersOpen,
        );
    const list = comments ? commentList(PART_THREADS, writing ? -1 : 0) : undefined;
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'System',
      product: 'studio',
      side: list ? withCommentList(tree.body, list.body) : tree.body,
      content: html`${frames}
        <div class="absolute top-space-3 right-space-3 flex gap-space-2">
          ${comment.body}${toggle.body}${dialog?.body ?? ''}
        </div>
        ${folded ? foldedStatesPill(FOLDED_SAMPLE) : ''}`,
    });

    return drawing({
      body: shell.body,
      setup: fit ? [menu.setup, fitAll] : menu.setup,
      styles:
        shell.styles +
        menu.styles +
        tree.styles +
        canvasFrameStyles +
        comment.styles +
        (list?.styles ?? '') +
        (writing?.styles ?? '') +
        toggle.styles +
        (dialog?.styles ?? '') +
        (folded ? disclosureStyles : ''),
    });
  },
});
