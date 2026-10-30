import { html } from '@design-system';
import { type Props as CommentPinProps } from '@system/components/comment-pin';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';

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

export const pinProps = ({ thread, selected }: Pin): CommentPinProps => {
  const first = thread[0];
  return {
    author: first?.author ?? '',
    ...(first?.agent ? { agent: first.agent } : { initials: first?.initials ?? '' }),
    count: thread.length,
    ...(selected ? { selected } : {}),
  };
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
