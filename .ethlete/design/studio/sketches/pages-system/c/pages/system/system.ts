import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import canvasFrames from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import { manyStatesView, treeRowGrid } from '@shared/many-states';
import { chip, chipRow, chipStyles } from '@ethlete/components/design/chip';
import { icon, type IconName } from '@system/foundations/icons';
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

const ghostBox = '<span class="block w-15 h-10 rounded-sm outline outline-surface-border bg-surface"></span>';

const emptyCanvas = html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
  <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
    <div class="grid grid-cols-2 gap-space-2" aria-hidden="true">${ghostBox}${ghostBox}${ghostBox}${ghostBox}</div>
    <p class="m-0 text-text font-ui-strong text-ui-md">Noch keine Teile</p>
    <p class="m-0 text-text-muted">
      Das Design-System eines Produkts wächst in Schichten: Foundations, Components, Elements und Pages. Dein Agent
      zeichnet jeden Teil als Sketch, du wählst unter Sketches. Bitte ihn zum Beispiel so:
    </p>
    <p class="m-0 p-space-3 rounded-(--radius-control-md) bg-surface-sunken text-text text-ui-sm">
      Lege die Foundations für studio an: Farben, Schrift und Abstände.
    </p>
    ${copy.body}
  </div>
</div>`;

const kindIcon = (name: IconName) => icon(name, { size: 14, cls: 'flex-none text-text-muted' });

type Filter = 'all' | PointGroup['kind'];

const filterChip = (label: string, selected: boolean) =>
  chip({ label, selection: 'radio', selected, attributes: 'data-et-control="filter" data-can-animate' });

const groupRows = ({ short, icon, lines }: PointGroup, max: number) => {
  const { shown, more } = collapsed(lines, max);
  return (
    shown
      .map(
        ({ text, detail }) =>
          html`<div class="contents">
            <span class="flex items-center gap-space-2 text-text-muted">${kindIcon(icon)}${short}</span>
            <span class="truncate text-text">${text}</span>
            <span class="font-code text-text-muted text-ui-xs">${detail}</span>
          </div>`,
      )
      .join('') +
    (more > 0 ? html`<span></span><span class="col-span-2 text-text-muted">+${more} weitere ${short}</span>` : '')
  );
};

const drawer = (open: PartOpenPoints, filter: Filter) => {
  const groups = groupsOf(open);
  const shown = groups.filter((group) => filter === 'all' || group.kind === filter);
  const chips = chipRow([
    filterChip(`Alle ${open.points.length}`, filter === 'all'),
    ...groups.map((group) => filterChip(`${group.short} ${group.lines.length}`, group.kind === filter)),
  ]);
  const body = groups.length
    ? html`<div
        class="flex-1 min-h-0 overflow-hidden grid grid-cols-[10rem_1fr_auto] content-start items-center gap-x-space-4 gap-y-space-1 px-space-4 py-space-2"
      >
        ${shown.map((group) => groupRows(group, filter === 'all' ? 3 : 8)).join('')}
      </div>`
    : html`<div class="flex-1 flex items-center justify-center gap-space-2 text-text-muted">
        ${checkIcon()}<span>Nichts offen. Jeder Zustand ist gezeichnet, verknüpft und besprochen.</span>
      </div>`;
  return html`<section
    class="absolute right-space-3 bottom-space-3 left-[calc(var(--st-shell-inset-left)+var(--space-3))] h-72 flex flex-col overflow-hidden rounded-control-lg border border-surface-border bg-surface text-ui-sm"
  >
    <header class="flex items-center gap-space-3 h-12 flex-none px-space-4 border-b border-surface-border">
      <span class="text-text font-ui-strong">Offen</span>
      ${groups.length ? chips : ''}
      <span class="ms-auto font-code text-text-muted text-ui-xs">${open.part}</span>
    </header>
    ${body}
  </section>`;
};

const emptySide = html`<p class="px-space-3 py-space-2 text-text-muted text-ui-sm">Noch keine Teile.</p>`;

export default definePart<{ empty?: boolean; manyStates?: boolean; nothingOpen?: boolean; filter?: Filter }>({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas. A product without parts shows a short line in the panel and a centred card on the canvas, the same card as the empty Flows page: a ghost of four boxes, a title, what the layers are, an example prompt for the agent and a copy button.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  states: {
    part: {},
    empty: { empty: true },
    'many-states': { manyStates: true },
    'filter-motions': { filter: 'missing-motion' },
    'nothing-open': { nothingOpen: true },
  },
  controls: { filter: { kind: 'button', part: 'components/chip' } },
  render: async ({ empty, manyStates, nothingOpen: clear, filter = 'all' }) => {
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
      content: html`<div class="absolute inset-x-0 top-0 bottom-78">${frames.body}</div>
        ${drawer(clear ? nothingOpen : buttonPoints, filter)}`,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles: shell.styles + menu.styles + tree.styles + frames.styles + chipStyles,
    });
  },
});
