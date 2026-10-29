import { definePart, drawing, html, svgAsset } from '@design-system';
import claude from '@assets/agent-claude.svg?raw';
import codex from '@assets/agent-codex.svg?raw';
import gemini from '@assets/agent-gemini.svg?raw';
import styles from './agent-logos.css?inline';

export type Agent = 'claude' | 'codex' | 'gemini';

export const agents: Agent[] = ['claude', 'codex', 'gemini'];

const logos: Record<Agent, string> = { claude, codex, gemini };

/** The brand mark of an agent as inline SVG, 1.2rem by default; `cls` lets a host size it in its own CSS. */
export const agentLogo = (agent: Agent, cls = '') =>
  svgAsset(logos[agent], { size: '1.2rem', class: cls, attrs: { 'aria-hidden': 'true' } });

type View = 'hosts' | 'detail';

const surfaces = ['surface-sunken', 'surface', 'surface-raised', 'surface-overlay'];

const hosts = html`<div class="al-root">
  <h2 class="al-title">Agent logos at 1.2rem, as the inbox, the sketches page and the comment pin draw them</h2>
  <div class="al-grid">
    ${surfaces
      .map(
        (surface) =>
          html`<div class="al-surface" style="background: var(--${surface})">
            <span class="al-label">--${surface}</span>
            <div class="al-row">
              ${agents.map((agent) => html`<span class="al-chip">${agentLogo(agent, 'al-logo')}${agent}</span>`).join('')}
            </div>
          </div>`,
      )
      .join('')}
  </div>
</div>`;

const detail = html`<div class="al-root">
  <h2 class="al-title">Agent logos at 3.2rem</h2>
  <div class="al-row al-row--wide">
    ${agents
      .map(
        (agent) =>
          html`<div class="al-size">
            ${agentLogo(agent, 'al-logo al-logo--large')}<span class="al-label">${agent}</span>
          </div>`,
      )
      .join('')}
  </div>
</div>`;

export default definePart<{ view: View }>({
  note: 'The agent logos as three SVG assets with one named export',
  madeBy: ['claude-opus-5-5'],
  states: { hosts: { view: 'hosts' }, detail: { view: 'detail' } },
  render: ({ view }) => drawing({ body: view === 'hosts' ? hosts : detail, styles }),
});
