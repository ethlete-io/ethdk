import { html } from '@design-system';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';

type Model = { name: string; agent: Agent };

export const OPUS: Model = { name: 'Opus 5.5', agent: 'claude' };
export const SOL: Model = { name: 'GPT-6.1 Sol', agent: 'codex' };

export const HOLD = { until: 'B34/B36/B38', since: 'seit 12 Min' };

export const modelName = (model: Model) =>
  html`<span class="inline-flex items-center gap-space-1"
    >${agentLogo(model.agent, 'size-3 flex-none')}${model.name}</span
  >`;

export const toggleHold = (root: HTMLElement) => {
  const trigger = root.querySelector<HTMLElement>('[data-sk-hold]');
  const reason = root.querySelector<HTMLElement>('[data-sk-hold-reason]');
  if (!trigger || !reason) return;
  trigger.addEventListener('click', () => {
    reason.hidden = !reason.hidden;
    trigger.setAttribute('aria-expanded', String(!reason.hidden));
  });
};

export type AgentRun = 'round' | 'variant' | 'failed';

export type AgentProgress = {
  by: Model;
  task: string;
  step: string;
  since: string;
  coming: string[];
  failed?: boolean;
};

export const AGENT_RUNS: Record<AgentRun, AgentProgress> = {
  round: { by: OPUS, task: 'baut Runde 2', step: 'Variante c, 1 von 2', since: 'seit 4 Min', coming: ['c', 'd'] },
  variant: { by: SOL, task: 'baut Variante c', step: 'Zustand reset-hover', since: 'seit 2 Min', coming: ['c'] },
  failed: {
    by: OPUS,
    task: 'Runde 2 fehlgeschlagen',
    step: 'tsc-Fehler in Variante d, zoom-chip.ts:14',
    since: 'vor 3 Min',
    coming: ['c', 'd'],
    failed: true,
  },
};
