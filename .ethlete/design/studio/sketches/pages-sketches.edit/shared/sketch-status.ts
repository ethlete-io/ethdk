import { html } from '@design-system';
import { modelName } from '@system/components/sketch-head';
import { SKETCHES_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';

export { AGENT_RUNS, type AgentRun, OPUS, SOL } from '@system/components/sketch-head';

type Model = Parameters<typeof modelName>[0];

export const drawingPlaceholder = (model: Model) =>
  html`<div
    class="flex size-full flex-col items-center justify-center gap-space-2 text-et-surface-muted"
    data-sk-placeholder
  >
    <span class="flex items-center gap-space-2 text-ui-lg font-ui-medium">
      <span class="size-2 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></span>
      ${modelName(model)} ${SKETCHES_LABELS.drawingVariant}
    </span>
    <span class="text-ui-sm">${SKETCHES_LABELS.drawingHint}</span>
  </div>`;
