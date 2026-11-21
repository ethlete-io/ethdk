import { html } from '@design-system';
import { disclosure } from '@system/components/disclosure';
import { STUDIO_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/studio-labels';

export const FOLDED_SAMPLE = 13;

export const foldedStatesPill = (count: number) =>
  html`<div
    class="absolute bottom-space-3 left-1/2 flex -translate-x-1/2 items-center gap-space-3 rounded-control-md border border-et-surface-border bg-et-surface-bg px-space-3 py-space-2 font-ui shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16))"
    data-folded-states
  >
    <span class="text-ui-sm text-et-surface-muted">${String(count)} weitere Zustände eingeklappt</span>
    ${disclosure({
      label: STUDIO_LABELS.system.showAllStates,
      body: '',
      open: false,
      size: 'xs',
      hug: true,
      action: 'emit:showAllStates',
    })}
  </div>`;
