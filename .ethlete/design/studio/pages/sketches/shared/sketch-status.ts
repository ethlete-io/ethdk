import { html } from '@design-system';
import { control } from '@ethlete/components/design/control';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';

export type SketchStatus = 'drawing' | 'paused' | 'idle';

type Model = { name: string; agent: Agent };

export const OPUS: Model = { name: 'Opus 5.5', agent: 'claude' };
export const SOL: Model = { name: 'GPT-6.1 Sol', agent: 'codex' };

export const HOLD = { until: 'B34/B36/B38', by: OPUS, since: 'seit 12 Min' };
export const IDLE = { since: 'seit 25 Min', last: 'Letzte Änderung von Opus 5.5' };

export const STATUS_LABEL: Record<SketchStatus, string> = {
  drawing: 'In Arbeit',
  paused: 'Pausiert',
  idle: 'Keine Aktivität',
};

export const modelName = (model: Model) =>
  html`<span class="inline-flex items-center gap-space-1"
    >${agentLogo(model.agent, 'size-3 flex-none')}${model.name}</span
  >`;

export const drawingPlaceholder = (model: Model) =>
  html`<div
    class="flex size-full flex-col items-center justify-center gap-space-2 text-et-surface-muted"
    data-sk-placeholder
  >
    <span class="flex items-center gap-space-2 text-ui-lg font-ui-medium">
      <span class="size-2 animate-pulse rounded-full bg-(--et-theme-color-primary-solid)"></span>
      ${modelName(model)} zeichnet diese Variante
    </span>
    <span class="text-ui-sm">Der Rahmen füllt sich, sobald die erste Ansicht steht.</span>
  </div>`;

export const holdReason = () =>
  html`<span class="flex flex-col gap-space-1">
    <span class="text-ui-sm font-ui-medium text-et-surface">Wartet auf ${HOLD.until}</span>
    <span class="flex items-center gap-space-1 text-ui-xs text-et-surface-muted"
      >Pausiert von ${modelName(HOLD.by)} · ${HOLD.since}</span
    >
  </span>`;

export const holdTrigger = (inner: string, cls: string, open: boolean) =>
  control(
    html`<button class="${cls}" type="button" data-sk-hold aria-expanded="${String(open)}">${inner}</button>`,
    'hold',
  );

export const toggleHold = (root: HTMLElement) => {
  const trigger = root.querySelector<HTMLElement>('[data-sk-hold]');
  const reason = root.querySelector<HTMLElement>('[data-sk-hold-reason]');
  if (!trigger || !reason) return;
  trigger.addEventListener('click', () => {
    reason.hidden = !reason.hidden;
    trigger.setAttribute('aria-expanded', String(!reason.hidden));
  });
};
