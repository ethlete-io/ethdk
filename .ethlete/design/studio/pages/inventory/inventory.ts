import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import zoomChip from '@system/components/zoom-chip';
import { canvasViewport, canvasViewportStyles } from '@system/components/canvas-viewport';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import {
  APPROVAL,
  DRAWING,
  FRAME,
  type InventoryPage,
  type Props,
  pageFrame,
  pageList,
  pagesOf,
} from './shared/inventory-sample';
import { STUDIO_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/studio-labels';

const COLUMNS = 2;

const atOf = (index: number) => ({
  x: 40 + (index % COLUMNS) * (FRAME.width + 48),
  y: 48 + Math.floor(index / COLUMNS) * (FRAME.height + 80),
});

const worldOf = (pages: InventoryPage[]) =>
  html`<div class="absolute top-0 left-(--st-shell-inset-left) origin-top-left">
    ${pages.map((page, index) => pageFrame(page, index === 0, atOf(index))).join('')}
  </div>`;

export default definePart<Props>({
  note: 'The Inventory of every page of the product, opened from Inventory in the studio menu: a canvas with the rest frame of each page (pan by wheel and drag, zoom with the zoom chip), each frame headed by its page and how many entries are open, a numbered box on every control, asset and overlay. A page picked in the part tree is selected and its frame outlined; the column at the right shows that page with its approval state, Neu laden and Inventory freigeben, and its entries in three sections: Bedienelemente, Assets (A1, A2 …) and Overlays (O1 …), each row with its name and what it belongs to. An undeclared control, an inline asset or a mocked overlay is red, an unclassified control amber; Approve stays off while either is left.',
  madeBy: ['claude-opus-5-5', 'design check', 'claude-sonnet-5-5'],
  implements: {
    route: '/',
    component: 'apps/ethlete-studio/src/app/design-parts/inventory-page/inventory-page.component.ts',
  },
  states: {
    open: { inventory: 'open' },
    approvable: { inventory: 'approvable' },
    approved: { inventory: 'approved' },
    loading: { inventory: 'loading' },
  },
  describe: {
    open: 'pages/flows selected with open entries; check its outlined frame with 3 offen, the numbered boxes on every frame and the three sections at the right with a red inline asset and a disabled Inventory freigeben.',
    approvable:
      'Every entry of pages/flows resolved but not yet approved; check bereit zur Freigabe on its frame, Noch nicht freigegeben at the right and that Inventory freigeben is enabled.',
    approved:
      'pages/flows approved; check freigegeben on its frame, the approval line with date and time at the right and that Inventory freigeben is disabled.',
    loading:
      'The inventory while it loads; check that Neu laden and Inventory freigeben are disabled and no frames or entries show.',
  },
  controls: {
    canvas: { kind: 'field', part: 'components/canvas-viewport' },
    reload: { kind: 'button', part: 'components/button' },
    approve: { kind: 'button', part: 'components/button' },
  },
  render: async ({ inventory }) => {
    const loading = inventory === 'loading';
    const pages = pagesOf(inventory);
    const selected = pages[0];
    const reload = await button.render({
      label: STUDIO_LABELS.inventory.reload,
      variant: 'outline',
      size: 'sm',
      disabled: loading,
    });
    const approve = await button.render({
      label: STUDIO_LABELS.inventory.approve,
      variant: 'filled',
      size: 'sm',
      disabled: loading || selected?.approval !== 'approvable',
    });
    const chip = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });
    const tree = await partTree.render({
      layers: [
        { title: 'Foundations', open: false, parts: [] },
        { title: 'Elements', open: false, parts: [] },
        { title: 'Components', open: false, parts: [] },
        {
          title: 'Pages',
          open: true,
          parts: [{ name: 'flows', leaf: true, selected: true }, { name: 'inbox' }, { name: 'system' }],
        },
      ],
    });
    const canvas = loading
      ? html`<p
          class="m-0 p-space-4 ps-[calc(var(--st-shell-inset-left)+var(--space-4))] text-ui-sm text-et-surface-muted"
        >
          ${DRAWING}
        </p>`
      : html`${canvasViewport({
          class: 'absolute inset-0 overflow-hidden',
          body: worldOf(pages),
        })}${chip.body}`;
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: html`<div class="grid h-full grid-cols-[minmax(0,1fr)_28rem]">
        <div class="relative min-h-0 overflow-hidden">${canvas}</div>
        <aside class="flex min-h-0 flex-col border-l border-et-surface-border bg-et-surface-bg">
          <header
            class="flex flex-wrap items-center gap-space-3 border-b border-et-surface-border px-space-4 py-space-3"
          >
            <div class="flex min-w-24 flex-1 basis-0 flex-col">
              <span class="truncate text-ui-sm text-et-surface-muted">${STUDIO_LABELS.inventory.title}</span>
              <h2 class="m-0 truncate text-ui-lg font-ui-strong">${loading ? '' : (selected?.part ?? '')}</h2>
            </div>
            ${control(withAction(reload.body, 'emit:reloadInventory'), 'reload')}
            ${control(withAction(approve.body, 'emit:approveInventory'), 'approve')}
            ${
              loading || !selected
                ? ''
                : `<p class="m-0 w-full text-ui-sm text-et-surface-muted">${APPROVAL[selected.approval]}</p>`
            }
          </header>
          ${
            loading || !selected
              ? ''
              : html`<div class="flex min-h-0 flex-col gap-space-5 overflow-auto p-space-4">${pageList(selected)}</div>`
          }
        </aside>
      </div>`,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles:
        shell.styles + menu.styles + tree.styles + reload.styles + approve.styles + chip.styles + canvasViewportStyles,
    });
  },
});
