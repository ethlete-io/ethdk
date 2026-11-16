import { html } from '@design-system';
import { canvasView } from '@system/elements/canvas-frames';
import { groupCount, stateFrame, stateGroupsPage, SYSTEM_GROUPS, type StateGroup } from '@shared/state-groups';

const section = (group: StateGroup) =>
  html`<section class="flex flex-col gap-space-4">
    <h3
      class="m-0 flex items-baseline gap-space-2 border-b border-et-surface-border pb-space-2 font-ui text-ui-lg text-et-surface"
    >
      ${group.name}${groupCount(group)}
    </h3>
    <div class="flex flex-wrap gap-x-10 gap-y-16 pt-10">${group.states.map(stateFrame).join('')}</div>
  </section>`;

export const stateGroupsView = async () => {
  const board = html`<div class="flex w-340 flex-wrap items-start gap-x-30 gap-y-20">
    ${SYSTEM_GROUPS.map(section).join('')}
  </div>`;
  return stateGroupsPage(await canvasView([board], '75%', {}, 'w-full', true));
};
