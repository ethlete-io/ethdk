import { control } from '@ethlete/components/design/control';
import { loaderStyles, spinner } from '@ethlete/components/design/loader';
import { definePart, drawing, html, slot } from '@design-system';
import anchoredDialog from '@system/components/anchored-dialog';
import button from '@system/components/button';
import textarea from '@system/components/textarea';
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

const act = (markup: string, action: string) => markup.replace(/<button\b/, `<button data-et-action="${action}"`);

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
    ${act(copy.body, 'emit:copyPrompt')}
  </div>
</div>`;

const chip = async (open: PartOpenPoints, pressed: boolean, focused: boolean, acting: boolean) => {
  const count = open.points.length;
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
    body: control(acting ? act(drawn.body, target) : drawn.body, 'open-points'),
    styles: drawn.styles,
  };
};

const commentButton = async (on: boolean, acting: boolean) => {
  const drawn = await button.render({ label: 'Kommentar', variant: 'outline', size: 'sm', pressed: on });
  const target = on ? 'points-closed' : 'comment-mode';
  return { body: control(acting ? act(drawn.body, target) : drawn.body, 'comment'), styles: drawn.styles };
};

const commentTarget = (frame: string) =>
  html`<div
    class="absolute inset-0 cursor-crosshair bg-(--et-theme-color-primary-solid)/6"
    title="Kommentar zu ${frame}"
    role="button"
    tabindex="0"
    data-et-action="comment-draft"
  ></div>`;

type SendPhase = 'busy' | 'error';

const LOADER = `<div class="et-button-loader" aria-hidden="true" data-et-skip="CLIPPED"><div class="et-button-loader-spinner contents">${spinner({ diameter: 12, strokeWidth: 1.5 })}</div></div>`;

const loading = (markup: string) =>
  markup
    .replace(/^<button /, '<button data-loading="true" aria-busy="true" aria-disabled="true" ')
    .replace(/<\/button>$/, `${LOADER}</button>`);

const sendError = html`<p
  class="m-0 flex items-center gap-space-1 text-et-theme-ink text-ui-xs"
  data-et-semantic-color="error"
  role="alert"
>
  ${icon('error', { size: 14, cls: 'flex-none text-et-theme' })}<span
    >Nicht gesendet. Der Design-Server hat nicht geantwortet.</span
  >
</p>`;

const commentDraft = async (text: string, phase?: SendPhase) => {
  const busy = phase === 'busy';
  const field = await textarea.render({
    field: {
      id: 'comment-draft',
      placeholder: 'Enter sendet, Umschalt+Enter macht einen Zeilenumbruch',
      rows: 3,
      disabled: busy,
      ...(text ? { value: text } : {}),
    },
  });
  const cancel = await button.render({
    label: 'Abbrechen',
    variant: 'transparent',
    color: 'surface',
    size: 'xs',
    disabled: busy,
  });
  const send = await button.render({
    label: phase === 'error' ? 'Erneut senden' : 'Senden',
    variant: 'filled',
    size: 'xs',
    disabled: !text,
  });
  const sendMarkup = busy ? loading(send.body) : text ? act(send.body, 'emit:sendComment') : send.body;
  const cancelMarkup = busy ? cancel.body : act(cancel.body, 'comment-mode');
  return {
    body: html`<div
      class="absolute left-[38%] top-[42%] z-4 flex w-80 flex-col gap-space-2 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-space-3 shadow-lg"
    >
      ${field.body.replace('<textarea', '<textarea aria-label="Kommentar"')}${phase === 'error' ? sendError : ''}
      <div class="flex justify-end gap-space-2">
        ${control(cancelMarkup, 'comment-cancel')}${control(sendMarkup, 'comment-send')}
      </div>
    </div>`,
    styles: field.styles + cancel.styles + send.styles + (busy ? loaderStyles : ''),
  };
};

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

const popover = async (open: PartOpenPoints) => {
  const groups = groupsOf(open);
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
      ${list}
    </div>`,
  });
  return {
    body: html`<div
      class="absolute top-full right-0 mt-2.5 [&_.et-overlay-arrow]:left-0"
      style="--et-floating-arrow-translate: translate3d(${groups.length ? 327 : 314.6796875}px, 0, 0); transform: translate3d(0, 0, 0)"
    >
      ${dialog.body}
    </div>`,
    styles: dialog.styles,
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
}>({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas. A product without parts shows a short line in the panel and a centred card on the canvas, the same card as the empty Flows page: a ghost of four boxes, a title, what the layers are, an example prompt for the agent and a copy button. Top right, beside the open-points chip, the Kommentar toggle turns comment mode on: each frame becomes a crosshair target, and a click opens a draft at that point with a text field, Abbrechen and Senden. While a comment is sent, the field and Abbrechen are disabled and Senden shows a spinner; a failed send keeps the text, shows an error line under the field and turns Senden into Erneut senden.',
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
  },
  controls: {
    comment: { kind: 'button', part: 'components/button' },
    'comment-cancel': { kind: 'button', part: 'components/button' },
    'comment-send': { kind: 'button', part: 'components/button' },
    'open-points': { kind: 'button', part: 'components/button' },
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
  }) => {
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
    const writing = draft === undefined ? undefined : await commentDraft(draft, send);
    const body = commentMode
      ? html`<div class="relative">${shot}${commentTarget('button')}${writing?.body ?? ''}</div>`
      : shot;
    const frames = await canvasView([canvasFrame('button', body)], '100%', {}, 'w-full', true);
    const points = clear ? nothingOpen : buttonPoints;
    const acting = !fit && !clear;
    const toggle = await chip(points, !closed, chipFocus, acting && !commentMode);
    const comment = await commentButton(commentMode, acting);
    const dialog = closed ? undefined : await popover(points);
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
