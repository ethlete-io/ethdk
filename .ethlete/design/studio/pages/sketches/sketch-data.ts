import { html } from '@design-system';
import { type Agent, agentLogo } from './agent-logos';

export type VariantKey = 'current' | 'g' | 'h' | 'i';

export type Variant = {
  key: VariantKey;
  label: string;
  author?: { name: string; agent: Agent };
  drawing?: boolean;
};

export type Comment = {
  author: string;
  initials: string;
  agent?: Agent;
  when: string;
  text: string;
};

export type Pin = { variant: VariantKey; state: string; thread: Comment[]; selected?: boolean };

export const avatar = (comment: Comment, cls: string) =>
  comment.agent
    ? `<span class="${cls}" data-agent>${agentLogo(comment.agent, 'sk-logo')}</span>`
    : `<span class="${cls}">${comment.initials}</span>`;

export const pinMark = (pin: Pin | undefined) => {
  if (!pin) return '';
  const first = pin.thread[0];
  if (!first) return '';
  const count = pin.thread.length > 1 ? `<span class="sk-pin-count">${pin.thread.length}</span>` : '';
  return html`<span class="sk-pin" ${pin.selected ? ' data-selected' : ''}
    >${avatar(first, 'sk-pin-face')}${count}</span
  >`;
};

export type PageVariant = { key: 'current' | 'a' | 'b'; label: string; note: string; author?: Variant['author'] };

export const PAGE_SKETCH = { part: 'pages/system', status: 'In Arbeit', state: 'part' };

export const PAGE_VARIANTS: PageVariant[] = [
  { key: 'current', label: 'Aktuell', note: 'Panel 248 px, offen' },
  { key: 'a', label: 'a', note: 'Panel ausgeblendet', author: { name: 'Claude', agent: 'claude' } },
  { key: 'b', label: 'b', note: 'Panel 200 px', author: { name: 'Codex', agent: 'codex' } },
];

export const PAGE_PIN: Pin = {
  variant: 'g',
  state: 'part',
  thread: [{ author: 'Tom Bornholdt', initials: 'TB', when: 'vor 5 Min', text: 'Ohne Panel fehlt mir der Baum.' }],
};

export const pageShot = (variant: PageVariant['key'], page: string, pin = '') =>
  html`<div class="sk-shot" data-page="${variant}" title="Doppelklick zum Einpassen">
    <div class="sk-shot-page">${page}</div>
    <span class="sk-shot-open">1440 × 900</span>
    ${pin}
  </div>`;

export const pageAuthor = (variant: PageVariant) =>
  variant.author
    ? `<span class="sk-author">${agentLogo(variant.author.agent, 'sk-logo')}${variant.author.name}</span>`
    : '';
