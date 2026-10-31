import { definePart, drawing, html } from '@design-system';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
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

const content = html`<div class="h-full box-border flex flex-col gap-space-4 ${pagePadding}">
  ${pageHeader(FLOW_NAME, `<div class="w-60">${presetPicker}</div>`)}
  <div class="flex-1 min-h-0 flex items-center justify-center">${flowGraph(0.18, 140)}</div>
</div>`;

export default definePart<FlowProps>({
  note: 'Flows as a canvas with a page header: a flat list of the flows in the side panel, the open flow name as the header title with the size picker at its right end, and the flow as a graph on the canvas: frames in columns along the lines, a branch on its own row, every line an elbow arrow with its label above the last segment.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
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
      styles: shell.styles + menu.styles + list.styles + presetPickerStyles + emptyStyles,
    });
  },
});
