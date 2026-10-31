import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import canvasFrames from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import treeRow, { type Row } from '@system/components/tree-row';
import { studioMenu } from '@system/elements/studio-menu';
import { manyStatesView, treeRowGrid } from '@shared/many-states';
import {
  buttonPoints,
  checkIcon,
  collapsed,
  groupsOf,
  nothingOpen,
  type PartOpenPoints,
  type PointGroup,
} from '@shared/open-points';

const copy = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });

const ghostBox =
  '<span class="block w-15 h-10 rounded-sm outline outline-(--et-surface-border-solid) et-surface--dark bg-(--et-surface-background-solid)"></span>';

const emptyCanvas = html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
  <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
    <div class="grid grid-cols-2 gap-space-2" aria-hidden="true">${ghostBox}${ghostBox}${ghostBox}${ghostBox}</div>
    <p class="m-0 text-(--et-surface-color-solid) font-ui-strong text-ui-md">Noch keine Teile</p>
    <p class="m-0 text-(--et-surface-color-muted-solid)">
      Das Design-System eines Produkts wächst in Schichten: Foundations, Components, Elements und Pages. Dein Agent
      zeichnet jeden Teil als Sketch, du wählst unter Sketches. Bitte ihn zum Beispiel so:
    </p>
    <p
      class="m-0 p-space-3 rounded-(--radius-control-md) et-surface--dark bg-(--et-surface-background-solid) text-(--et-surface-color-solid) text-ui-sm"
    >
      Lege die Foundations für studio an: Farben, Schrift und Abstände.
    </p>
    ${copy.body}
  </div>
</div>`;

const pointRows = ({ kind, title, lines }: PointGroup): Row[] => {
  const { shown, more } = collapsed(lines, 5);
  return [
    { label: `${title} <span class="tabular-nums">${lines.length}</span>`, depth: 0, kind: 'group', expanded: true },
    ...shown.map(({ text, detail }): Row => ({
      label: `${text} <span class="font-code text-(--et-surface-color-muted-solid) text-ui-xs">${detail}</span>`,
      depth: 1,
      kind: 'leaf',
      ...(kind === 'contrast' ? { warning: 'Kontrast unter der Regel' } : {}),
      ...(kind === 'open-comment' ? { comments: 1 } : {}),
    })),
    ...(more > 0 ? [{ label: `+${more} weitere`, depth: 1, kind: 'leaf', inert: true } satisfies Row] : []),
  ];
};

const inspector = async (open: PartOpenPoints) => {
  const groups = groupsOf(open);
  const body = groups.length
    ? html`<div class="flex-1 min-h-0 overflow-hidden px-space-2 pb-space-2 text-ui-sm">
        ${(await treeRow.render({ rows: groups.flatMap(pointRows) })).body}
      </div>`
    : html`<div class="flex-1 flex flex-col items-center justify-center gap-space-2 px-space-6 text-center">
        ${checkIcon(20)}
        <p class="m-0 text-(--et-surface-color-solid) font-ui-strong text-ui-sm">Nichts offen</p>
        <p class="m-0 text-(--et-surface-color-muted-solid) text-ui-xs">
          Jeder Zustand ist gezeichnet, verknüpft und besprochen.
        </p>
      </div>`;
  return html`<aside
    class="absolute top-space-3 right-space-3 bottom-space-3 w-80 flex flex-col min-h-0 overflow-hidden rounded-control-lg et-surface--dark bg-(--et-surface-background-solid) border border-(--et-surface-border-solid)"
  >
    <header
      class="flex items-center gap-space-2 h-12 flex-none px-space-4 mb-space-2 border-b border-(--et-surface-border-solid)"
    >
      <span class="text-(--et-surface-color-solid) font-ui-strong text-ui-sm">Offen</span>
      <span class="text-(--et-surface-color-muted-solid) tabular-nums text-ui-sm">${open.points.length || ''}</span>
      <span class="ms-auto font-code text-(--et-surface-color-muted-solid) text-ui-xs">${open.part}</span>
    </header>
    ${body}
  </aside>`;
};

const emptySide = html`<p class="px-space-3 py-space-2 text-(--et-surface-color-muted-solid) text-ui-sm">
  Noch keine Teile.
</p>`;

export default definePart<{ empty?: boolean; manyStates?: boolean; nothingOpen?: boolean }>({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas. A product without parts shows a short line in the panel and a centred card on the canvas, the same card as the empty Flows page: a ghost of four boxes, a title, what the layers are, an example prompt for the agent and a copy button.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  states: {
    part: {},
    empty: { empty: true },
    'many-states': { manyStates: true },
    'nothing-open': { nothingOpen: true },
  },
  render: async ({ empty, manyStates, nothingOpen: clear }) => {
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
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: html`<div class="absolute inset-y-0 left-0 right-86">${frames.body}</div>
        ${await inspector(clear ? nothingOpen : buttonPoints)}`,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles: shell.styles + menu.styles + tree.styles + frames.styles,
    });
  },
});
