import { html } from '@design-system';
import { disclosure } from '@system/components/disclosure';
import disclosureStyles from '@system/components/disclosure.css?inline';
import { canvasView } from '@system/elements/canvas-frames';
import { groupCount, stateFrame, stateGroupsPage, SYSTEM_GROUPS, type StateGroup } from '@shared/state-groups';

const OPEN_GROUP = 'agent';

const indexEntry = (group: StateGroup) =>
  html`<li
    class="flex items-baseline justify-between gap-space-4 px-space-3 py-space-1 ${
      group.name === OPEN_GROUP
        ? 'bg-[color-mix(in_srgb,var(--et-surface-interaction-solid)_12%,transparent)] text-et-surface'
        : 'text-et-surface-muted'
    }"
  >
    <span>${group.name}</span>${groupCount(group)}
  </li>`;

const index = html`<nav
  class="absolute top-space-3 inset-s-[calc(var(--st-shell-inset-left,0px)+var(--space-3))] w-48 border border-et-surface-border bg-et-surface-bg py-space-1 font-ui text-ui-sm"
  aria-label="Gruppen"
>
  <ul class="m-0 list-none p-0">
    ${SYSTEM_GROUPS.map(indexEntry).join('')}
  </ul>
</nav>`;

const fold = (group: StateGroup) => {
  const open = group.name === OPEN_GROUP;
  const line = disclosure({
    label: `${group.name} · ${group.states.length}`,
    open,
    size: 'sm',
    hug: true,
    body: html`<div class="flex flex-wrap gap-x-10 gap-y-16 pt-14">${group.states.map(stateFrame).join('')}</div>`,
  });
  const names = open
    ? ''
    : html`<p class="m-0 ps-space-6 font-code text-ui-xs text-et-surface-muted">${group.states.join(' · ')}</p>`;
  return html`<section class="flex flex-col gap-space-1">${line}${names}</section>`;
};

export const stateGroupsView = async () => {
  const board = html`<div class="flex w-300 flex-col gap-space-4 ps-60 font-ui">
    ${SYSTEM_GROUPS.map(fold).join('')}
  </div>`;
  const canvas = await canvasView([board], '75%', {}, 'w-full', true);
  return stateGroupsPage(html`<div class="relative h-full">${canvas}${index}</div>`, disclosureStyles);
};
