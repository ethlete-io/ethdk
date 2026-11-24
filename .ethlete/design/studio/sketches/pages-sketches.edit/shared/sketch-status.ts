import { html } from '@design-system';

export { AGENT_RUNS, type AgentRun, OPUS, SOL } from '@system/components/sketch-head';

export const drawingPlaceholder = () =>
  html`<div class="flex size-full items-center justify-center" data-sk-placeholder>
    <span class="size-2 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></span>
  </div>`;
