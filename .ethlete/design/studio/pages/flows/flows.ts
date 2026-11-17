import { definePart, drawing, html } from '@design-system';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import zoomChip from '@system/components/zoom-chip';
import { canvasViewport, canvasViewportStyles } from '@system/components/canvas-viewport';
import {
  FLOW_NAME,
  type FlowProps,
  copyButton,
  emptyCanvasOf,
  emptySide,
  flatFlowList,
  flowGraph,
  pageHeader,
  pagePadding,
  presetPickerOf,
} from './shared/flow-data';

const contentOf = (presetPicker: string, chip: string) =>
  html`<div class="relative h-full overflow-hidden">
    <div class="h-full box-border flex flex-col gap-space-4 ${pagePadding}">
      ${pageHeader(FLOW_NAME, `<div class="w-60">${presetPicker}</div>`)}
      ${canvasViewport({ class: 'flex-1 min-h-0', body: flowGraph(0.18, 140) })}
    </div>
    ${chip}
  </div>`;

export default definePart<FlowProps>({
  note: 'Flows as a canvas with a page header: a flat list of the flows in the side panel, the open flow name as the header title with the size picker at its right end, and the flow as a graph on a canvas with the sketch camera (pan by wheel and drag, zoom with the zoom chip in the corner; a flow starts at 100 % with its first frame at the left edge, below the header): frames in columns along the lines, a branch on its own row, every line an elbow arrow with its label above the last segment.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/flows-page/flows-page.component.ts' },
  states: { flow: { flow: 'open' }, empty: { flow: 'none' } },
  describe: {
    flow: 'An open flow on the canvas; check the flow list with the open one marked, its name in the header with the size picker and the zoom chip in the corner.',
    empty:
      'A product without flows; check the empty side panel and the centred card with its copy button on the empty canvas.',
  },
  controls: { canvas: { kind: 'field', part: 'components/canvas-viewport' } },
  render: async ({ flow }) => {
    const picker = await presetPickerOf();
    const copy = await copyButton();
    const chip = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });
    const list = await flatFlowList();
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Flows',
      product: 'studio',
      side: flow === 'open' ? list.body : emptySide,
      content: flow === 'open' ? contentOf(picker.body, chip.body) : emptyCanvasOf(copy.body),
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles:
        shell.styles + menu.styles + list.styles + picker.styles + copy.styles + chip.styles + canvasViewportStyles,
    });
  },
});
