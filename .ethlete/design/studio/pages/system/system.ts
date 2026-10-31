import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import canvasFrames from '@system/elements/canvas-frames';
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

const copy = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });

const ghostBox =
  '<span class="block w-15 h-10 rounded-sm outline outline-et-surface-border et-surface--dark bg-et-surface-bg"></span>';

const emptyCanvas = html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
  <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
    <div class="grid grid-cols-2 gap-space-2" aria-hidden="true">${ghostBox}${ghostBox}${ghostBox}${ghostBox}</div>
    <p class="m-0 text-et-surface font-ui-strong text-ui-md">Noch keine Teile</p>
    <p class="m-0 text-et-surface-muted">
      Das Design-System eines Produkts wächst in Schichten: Foundations, Components, Elements und Pages. Dein Agent
      zeichnet jeden Teil als Sketch, du wählst unter Sketches. Bitte ihn zum Beispiel so:
    </p>
    <p class="m-0 p-space-3 rounded-(--radius-control-md) et-surface--dark bg-et-surface-bg text-et-surface text-ui-sm">
      Lege die Foundations für studio an: Farben, Schrift und Abstände.
    </p>
    ${copy.body}
  </div>
</div>`;

const chip = async (open: PartOpenPoints, pressed: boolean) => {
  const count = open.points.length;
  const drawn = await button.render({
    label: count ? `${count} offen` : 'Nichts offen',
    icon: count ? icon('warning', { size: 14, cls: 'et-color--warning text-et-theme' }) : checkIcon(14),
    variant: 'outline',
    size: 'sm',
    pressed,
  });
  return {
    body: control(drawn.body, 'open-points'),
    styles: drawn.styles,
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

const popover = (open: PartOpenPoints) => {
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
  return html`<div
    class="absolute top-14 right-space-3 w-96 rounded-control-lg border border-et-surface-interaction et-surface--dark-elevated-2 bg-(--et-surface-background-solid) shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16)) text-ui-sm"
  >
    <header
      class="flex items-baseline gap-space-2 px-space-3 pt-space-3 pb-space-2 border-b border-(--et-surface-border-solid)"
    >
      <span class="text-(--et-surface-color-solid) font-ui-strong"
        >${groups.length ? 'Offene Punkte' : 'Nichts offen'}</span
      >
      <span class="ms-auto font-code text-(--et-surface-color-muted-solid) text-ui-xs">${open.part}</span>
    </header>
    ${list}
  </div>`;
};

const emptySide = html`<p class="px-space-3 py-space-2 text-et-surface-muted text-ui-sm">Noch keine Teile.</p>`;

export default definePart<{ empty?: boolean; manyStates?: boolean; nothingOpen?: boolean; closed?: boolean }>({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas. A product without parts shows a short line in the panel and a centred card on the canvas, the same card as the empty Flows page: a ghost of four boxes, a title, what the layers are, an example prompt for the agent and a copy button.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  states: {
    part: {},
    empty: { empty: true },
    'many-states': { manyStates: true },
    'points-closed': { closed: true },
    'nothing-open': { nothingOpen: true },
  },
  controls: { 'open-points': { kind: 'button', part: 'components/button' } },
  render: async ({ empty, manyStates, nothingOpen: clear, closed }) => {
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
    const frames = await canvasFrames.render(canvasFrames.states.default);
    const points = clear ? nothingOpen : buttonPoints;
    const toggle = await chip(points, !closed);
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: html`${frames.body}
        <div class="absolute top-space-3 right-space-3">${toggle.body}</div>
        ${closed ? '' : popover(points)}`,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles: shell.styles + menu.styles + tree.styles + frames.styles + toggle.styles,
    });
  },
});
