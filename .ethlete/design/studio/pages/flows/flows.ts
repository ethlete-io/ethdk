import { definePart, drawing, html } from '@design-system';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import zoomChip from '@system/components/zoom-chip';
import {
  FLOW_NAME,
  type FlowProps,
  emptyCanvas,
  emptySide,
  emptyStyles,
  flatFlowList,
  flowGraph,
  pageHeader,
  pagePadding,
  presetPicker,
  presetPickerStyles,
} from './shared/flow-data';

const chip = await zoomChip.render({ percent: 100, class: 'absolute right-space-3 bottom-space-3 z-3' });

const content = html`<div class="relative h-full overflow-hidden">
  <div class="h-full box-border flex flex-col gap-space-4 ${pagePadding}">
    ${pageHeader(FLOW_NAME, `<div class="w-60">${presetPicker}</div>`)}
    <div class="flex-1 min-h-0">${flowGraph(0.18, 140)}</div>
  </div>
  ${chip.body}
</div>`;

export default definePart<FlowProps>({
  note: 'Flows as a canvas with a page header: a flat list of the flows in the side panel, the open flow name as the header title with the size picker at its right end, and the flow as a graph on a canvas with the sketch camera (pan by wheel and drag, zoom with the zoom chip in the corner; a flow starts at 100 % with its first frame at the left edge, below the header): frames in columns along the lines, a branch on its own row, every line an elbow arrow with its label above the last segment.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/flows-page/flows-page.component.ts' },
  states: { flow: { flow: 'open' }, empty: { flow: 'none' } },
  render: async ({ flow }) => {
    const list = await flatFlowList();
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'Flows',
      product: 'studio',
      side: flow === 'open' ? list.body : emptySide,
      content: flow === 'open' ? content : emptyCanvas,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles: shell.styles + menu.styles + list.styles + presetPickerStyles + emptyStyles + chip.styles,
    });
  },
});
