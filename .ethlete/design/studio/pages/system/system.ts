import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, slot, withAction } from '@design-system';
import { commentDraft } from '@system/components/comment-draft';
import anchoredDialog from '@system/components/anchored-dialog';
import button from '@system/components/button';
import { commentTarget } from '@system/components/comment-target';
import { canvasFrame, canvasFrameStyles, canvasView, stateGrid } from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import { manyStatesView, treeRowGrid } from './shared/many-states';
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
import { approvalControl, buttonExceptions, callView, exceptionRows, type Approval } from './shared/capabilities';

const copy = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });

const ghostBox = '<span class="block w-15 h-10 rounded-sm outline outline-et-surface-border bg-et-surface-bg"></span>';

const emptyCanvas = html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
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
    ${withAction(copy.body, 'emit:copyPrompt')}
  </div>
</div>`;

const chip = async (open: PartOpenPoints, pressed: boolean, focused: boolean, acting: boolean, exceptions: number) => {
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
    focused ? { interaction: 'focus-visible' } : {},
  );
  const target = pressed ? 'points-closed' : 'part';
  return {
    body: control(acting ? withAction(drawn.body, target) : drawn.body, 'open-points'),
    styles: drawn.styles,
  };
};

const commentButton = async (on: boolean, acting: boolean) => {
  const drawn = await button.render({ label: 'Kommentar', variant: 'outline', size: 'sm', pressed: on });
  const target = on ? 'points-closed' : 'comment-mode';
  return { body: control(acting ? withAction(drawn.body, target) : drawn.body, 'comment'), styles: drawn.styles };
};

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

const popover = async (open: PartOpenPoints, approval: Approval, withExceptions: boolean) => {
  const groups = groupsOf(open);
  const exceptions = withExceptions ? await exceptionGroup() : undefined;
  const approve = await approvalControl(approval, 'xs');
  const footer = html`<footer
    class="flex items-center justify-end gap-space-2 border-t border-(--et-surface-border-solid) px-space-3 py-space-2"
  >
    ${approve.body}
  </footer>`;
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
    content: html`<div class="w-96 text-ui-sm">
      <header
        class="flex items-baseline gap-space-2 px-space-3 pt-space-3 pb-space-2 border-b border-(--et-surface-border-solid)"
      >
        <span class="text-(--et-surface-color-solid) font-ui-strong"
          >${groups.length ? 'Offene Punkte' : 'Nichts offen'}</span
        >
        <span class="ms-auto font-code text-(--et-surface-color-muted-solid) text-ui-xs">${open.part}</span>
      </header>
      ${list}${exceptions?.body ?? ''}${footer}
    </div>`,
  });
  return {
    body: html`<div
      class="absolute top-full right-0 mt-2.5 [&_.et-overlay-arrow]:left-0"
      style="--et-floating-arrow-translate: translate3d(${groups.length ? 327 : 314.6796875}px, 0, 0); transform: translate3d(0, 0, 0)"
    >
      ${dialog.body}
    </div>`,
    styles: dialog.styles + (exceptions?.styles ?? '') + approve.styles,
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

const buttonGrid = async () => {
  const rows = await Promise.all(
    (['filled', 'outline', 'tonal'] as const).map(async (variant) => ({
      label: variant,
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

export default definePart<{
  empty?: boolean;
  manyStates?: boolean;
  nothingOpen?: boolean;
  closed?: boolean;
  fit?: boolean;
  chipFocus?: boolean;
  commentMode?: boolean;
  draft?: string;
  send?: SendPhase;
  reason?: string;
  approval?: Approval;
  call?: 'open' | 'transferred';
}>({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas. A product without parts shows a short line in the panel and a centred card on the canvas, the same card as the empty Flows page: a ghost of four boxes, a title, what the layers are, an example prompt for the agent and a copy button. Top right, beside the open-points chip, the Kommentar toggle turns comment mode on: each frame becomes a crosshair target, and a click opens a draft at that point with a text field, Abbrechen and Senden. While a comment is sent, the field and Abbrechen are disabled and Senden shows a spinner; a failed send keeps the text: a network or server error shows "Kommentar nicht gesendet. Erneut versuchen." under the field and turns Senden into Erneut senden; a send the server refuses with a 4xx shows the server reason there and keeps Senden, with no retry. The open-points popover also lists the exceptions of the part as an Ausnahmen group, each with its reason, state and a Freigeben button, and ends in a footer with Go geben (Go erteilt once given), or Änderung abnehmen for a direct edit of a merged part (Änderung abgenommen once done); the chip counts the exceptions with the points. A legacy call shows a header with its slug and headline, the surface and colour theme switches, and Als übertragen markieren, which turns into an übertragen badge.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  implements: {
    route: '/',
    component: 'apps/ethlete-studio/src/app/design-parts/system-page/system-page.component.ts',
  },
  states: {
    part: {},
    empty: { empty: true },
    'many-states': { manyStates: true },
    fit: { fit: true },
    'points-closed': { closed: true },
    'nothing-open': { nothingOpen: true },
    'part-focus-visible': { chipFocus: true },
    'points-closed-focus-visible': { closed: true, chipFocus: true },
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
    'go-given': { approval: 'go-given' },
    'direct-edit': { approval: 'accept' },
    'edit-accepted': { approval: 'accepted' },
    call: { call: 'open' },
    'call-transferred': { call: 'transferred' },
  },
  controls: {
    comment: { kind: 'button', part: 'components/button' },
    'comment-cancel': { kind: 'button', part: 'components/button' },
    'comment-send': { kind: 'button', part: 'components/button' },
    'comment-target': { kind: 'button', part: 'components/comment-target' },
    'open-points': { kind: 'button', part: 'components/button' },
    'give-go': { kind: 'button', part: 'components/button' },
    accept: { kind: 'button', part: 'components/button' },
    'exception-approve': { kind: 'button', part: 'components/button' },
    transfer: { kind: 'button', part: 'components/button' },
    theme: { kind: 'button', part: 'components/button' },
    popover: { kind: 'disclosure', part: 'components/anchored-dialog', surfaces: { body: 'open-points' } },
  },
  render: async ({
    empty,
    manyStates,
    nothingOpen: clear,
    closed,
    fit,
    chipFocus = false,
    commentMode = false,
    draft,
    send,
    reason,
    approval = 'go',
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

    if (empty) {
      const menu = await studioMenu({ open: false });
      const shell = await shellMain.render({
        studio: menu.body,
        section: 'System',
        product: 'studio',
        side: emptySide,
        content: emptyCanvas,
      });

      return drawing({ body: shell.body, setup: menu.setup, styles: shell.styles + menu.styles + copy.styles });
    }

    const tree = await partTree.render(partTree.states['components-open']);
    const shot = fit
      ? html`<div class="w-md h-45" ${slot('shot')}></div>`
      : html`<div ${slot('shot')}>${await buttonGrid()}</div>`;
    const writing = draft === undefined ? undefined : await commentDraft({ text: draft, phase: send, reason });
    const target = control(commentTarget({ frame: 'button', action: 'comment-draft' }), 'comment-target');
    const body = commentMode
      ? html`<div class="relative">
          ${shot}${target}${writing ? html`<div class="absolute left-[38%] top-[42%]">${writing.body}</div>` : ''}
        </div>`
      : shot;
    const frames = await canvasView([canvasFrame('button', body)], '100%', {}, 'w-full', true);
    const points = clear ? nothingOpen : buttonPoints;
    const acting = !fit && !clear;
    const exceptionCount = clear ? 0 : buttonExceptions.length;
    const toggle = await chip(points, !closed, chipFocus, acting && !commentMode, exceptionCount);
    const comment = await commentButton(commentMode, acting);
    const dialog = closed ? undefined : await popover(points, approval, exceptionCount > 0);
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: html`${frames}
        <div class="absolute top-space-3 right-space-3 flex gap-space-2">
          ${comment.body}${toggle.body}${dialog?.body ?? ''}
        </div>`,
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
        (writing?.styles ?? '') +
        toggle.styles +
        (dialog?.styles ?? ''),
    });
  },
});
