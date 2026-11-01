import { definePart, drawing, html, svgAsset } from '@design-system';
import { agentLogoSvg } from '../../../../../apps/ethlete-studio/src/app/icons/agent-logos';
import copilot from '@assets/agent-copilot.svg?raw';
import cursor from '@assets/agent-cursor.svg?raw';
import deepseek from '@assets/agent-deepseek.svg?raw';
import generic from '@assets/agent-generic.svg?raw';
import grok from '@assets/agent-grok.svg?raw';
import kimi from '@assets/agent-kimi.svg?raw';
import meta from '@assets/agent-meta.svg?raw';
import mistral from '@assets/agent-mistral.svg?raw';
import qwen from '@assets/agent-qwen.svg?raw';

export type Agent =
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'grok'
  | 'deepseek'
  | 'kimi'
  | 'meta'
  | 'qwen'
  | 'mistral'
  | 'cursor'
  | 'copilot'
  | 'generic';

export const agents: Agent[] = [
  'claude',
  'codex',
  'gemini',
  'grok',
  'deepseek',
  'kimi',
  'meta',
  'qwen',
  'mistral',
  'cursor',
  'copilot',
  'generic',
];

const logos: Record<Agent, string> = {
  claude: agentLogoSvg('claude'),
  codex: agentLogoSvg('codex'),
  gemini: agentLogoSvg('gemini'),
  grok,
  deepseek,
  kimi,
  meta,
  qwen,
  mistral,
  cursor,
  copilot,
  generic,
};

/** The brand mark of an agent as inline SVG, 1.2rem by default; `cls` lets a host size it in its own CSS. */
export const agentLogo = (agent: Agent, cls = '') =>
  svgAsset(logos[agent], { size: '1.2rem', class: cls, attrs: { 'aria-hidden': 'true' } });

type View = 'hosts' | 'detail';

const surfaces = [
  { name: 'surface', cls: 'et-surface--dark bg-et-surface-bg' },
  { name: 'surface-dark-elevated', cls: 'et-surface--dark-elevated bg-et-surface-bg' },
  { name: 'surface-dark-elevated-2', cls: 'et-surface--dark-elevated-2 bg-et-surface-bg' },
];

const hosts = html`<div class="flex flex-col gap-space-4 p-space-6 bg-et-surface-bg text-text font-ui text-ui-md">
  <h2 class="m-0 text-ui-xl font-ui-strong">
    Agent logos at 1.2rem, as the inbox, the sketches page and the comment pin draw them
  </h2>
  <div class="grid grid-cols-[repeat(2,max-content)] gap-space-3">
    ${surfaces
      .map(
        (surface) =>
          html`<div
            class="flex flex-col gap-space-2 px-space-4 py-space-3 border border-et-surface-border rounded-control-md ${surface.cls}"
          >
            <span class="font-code text-ui-xs text-text-muted">--${surface.name}</span>
            <div class="flex items-center gap-space-4">
              ${agents.map((agent) => html`<span class="inline-flex items-center gap-space-1 text-ui-sm">${agentLogo(agent, 'shrink-0 size-3')}${agent}</span>`).join('')}
            </div>
          </div>`,
      )
      .join('')}
  </div>
</div>`;

const detail = html`<div class="flex flex-col gap-space-4 p-space-6 bg-et-surface-bg text-text font-ui text-ui-md">
  <h2 class="m-0 text-ui-xl font-ui-strong">Agent logos at 3.2rem</h2>
  <div class="flex items-center gap-space-7">
    ${agents
      .map(
        (agent) =>
          html`<div class="flex flex-col items-center gap-space-2">
            ${agentLogo(agent, 'shrink-0 size-8')}<span class="font-code text-ui-xs text-text-muted">${agent}</span>
          </div>`,
      )
      .join('')}
  </div>
</div>`;

export default definePart<{ view: View }>({
  note: 'The agent logos as SVG assets with one named export; generic stands for a provider without its own mark',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: { hosts: { view: 'hosts' }, detail: { view: 'detail' } },
  render: ({ view }) => drawing({ body: view === 'hosts' ? hosts : detail }),
});
