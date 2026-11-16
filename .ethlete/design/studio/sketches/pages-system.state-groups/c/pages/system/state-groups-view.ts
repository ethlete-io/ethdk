import { html } from '@design-system';
import tabs from '@system/components/tabs';
import { canvasView } from '@system/elements/canvas-frames';
import { stateFrame, stateGroupsPage, SYSTEM_GROUPS } from '@shared/state-groups';

const SELECTED = 'agent';

export const stateGroupsView = async () => {
  const labels = SYSTEM_GROUPS.map((group) => `${group.name} ${group.states.length}`);
  const index = SYSTEM_GROUPS.findIndex((each) => each.name === SELECTED);
  const group = SYSTEM_GROUPS[index] ?? { name: SELECTED, states: [] };
  const bar = await tabs.render({ tabs: labels.map((label) => ({ label })), selected: index, size: 'sm' });
  const board = html`<div class="flex w-300 flex-wrap gap-x-10 gap-y-16">
    ${group.states.map(stateFrame).join('')}
  </div>`;
  const canvas = await canvasView([board], '75%', {}, 'w-full', true);
  const content = html`<div class="flex h-full flex-col">
    <div class="ps-(--st-shell-inset-left) pt-space-2">${bar.body}</div>
    <div class="min-h-0 flex-1">${canvas}</div>
  </div>`;
  return stateGroupsPage(content, bar.styles);
};
