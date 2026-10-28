import { html } from '@design-system';
import type partTree from '@system/elements/part-tree';
import { type Agent, agentLogo } from './agent-logos';

export type TreeProps = Parameters<typeof partTree.render>[0];

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

export type Round = { key: string; title: string; note: string; variants: string[] };

export const SKETCH = { part: 'elements/part-tree', status: 'In Arbeit' };

export const ROUNDS: Round[] = [
  { key: 'r3', title: 'Kleinere Baumschrift', note: '', variants: ['g', 'h', 'i'] },
  {
    key: 'r2',
    title: 'Zeilenhöhe 24 px',
    note: 'd und e zeigten 24 und 28 px Zeilen; beide machten den Baum zu lang für ein Produkt mit vielen Teilen.',
    variants: ['d', 'e', 'f'],
  },
  {
    key: 'r1',
    title: 'Baum ohne Zähler',
    note: 'a, b und c zeigten Zähler, Punkte und nichts; die Zähler lenkten ab, gewählt wurde c.',
    variants: ['a', 'b', 'c'],
  },
];

export const VARIANTS: Variant[] = [
  { key: 'current', label: 'Aktuell' },
  { key: 'g', label: 'g', author: { name: 'Claude', agent: 'claude' } },
  { key: 'h', label: 'h', author: { name: 'Codex', agent: 'codex' } },
  { key: 'i', label: 'i', author: { name: 'Gemini', agent: 'gemini' }, drawing: true },
];

export const NOTES: Record<VariantKey, string> = {
  current: '1.1rem auf 20 px Zeilen',
  g: '1.0rem auf 18 px Zeilen',
  h: '1.0rem, Zeilen bleiben 20 px',
  i: '0.95rem auf 17 px Zeilen',
};

const elementsOpen: TreeProps = {
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    {
      title: 'Elements',
      open: true,
      parts: [
        { name: 'canvas-frames', leaf: true },
        { name: 'part-tree', selected: true, states: [{ name: 'components-open', selected: true }] },
        { name: 'shell-main', warns: true },
      ],
    },
    { title: 'Components', open: false, parts: [] },
    { title: 'Pages', open: false, parts: [] },
  ],
};

export const changedStates = (componentsOpen: TreeProps): { name: string; props: TreeProps }[] => [
  { name: 'components-open', props: componentsOpen },
  { name: 'elements-open', props: elementsOpen },
];

export const UNCHANGED_STATES = ['all-closed'];

export const PINS: Pin[] = [
  {
    variant: 'g',
    state: 'components-open',
    selected: true,
    thread: [
      {
        author: 'Tom Bornholdt',
        initials: 'TB',
        when: 'vor 12 Min',
        text: 'g liest sich gut, aber die Ebenen-Titel werden jetzt zu blass.',
      },
      {
        author: 'Claude',
        initials: 'C',
        agent: 'claude',
        when: 'vor 9 Min',
        text: 'Ich hebe die Titel in der nächsten Runde auf text statt text-muted. Soll g dafür die Basis sein?',
      },
    ],
  },
  {
    variant: 'h',
    state: 'elements-open',
    thread: [
      {
        author: 'Codex',
        initials: 'CX',
        agent: 'codex',
        when: 'vor 30 Min',
        text: 'h hält die Trefferfläche bei 20 px, nur die Schrift wird kleiner.',
      },
    ],
  },
];

const chevron =
  '<svg class="sk-fold-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6.5 4.5 3.5 3.5-3.5 3.5"/></svg>';

export const CONTEXT_PAGES = ['pages/system'];

export const pinOf = (variant: VariantKey, state: string) =>
  PINS.find((pin) => pin.variant === variant && pin.state === state);

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

export const authorMark = (variant: Variant) =>
  variant.author
    ? `<span class="sk-author">${agentLogo(variant.author.agent, 'sk-logo')}${variant.author.name}</span>`
    : '';

export const drawingLabel = (variant: Variant) =>
  variant.drawing && variant.author
    ? `<span class="sk-drawing" role="status" title="Agent zeichnet noch"><span aria-hidden="true">●</span> Zeichnet</span>`
    : '';

export const typed = (variant: VariantKey, body: string) => `<div class="sk-type" data-type="${variant}">${body}</div>`;

export const contextCrop = (variant: VariantKey, page: string) =>
  `<figure class="sk-frame sk-context-frame"><figcaption class="sk-frame-caption">pages/system · desktop</figcaption><div class="sk-crop">${typed(variant, `<div class="sk-crop-page">${page}</div>`)}</div></figure>`;

export const roundHead = (round: Round, index: number, total: number) =>
  html`<div class="sk-round-head">
    <span class="sk-round-key">Runde ${total - index}</span>
    <span class="sk-round-title">${round.title}</span>
  </div>`;

export const foldedRound = (round: Round, index: number, total: number) =>
  html`<div class="sk-fold" data-kind="round">
    ${chevron}
    <span class="sk-round-key">Runde ${total - index}</span>
    <span class="sk-round-title">${round.title}</span>
    <span class="sk-fold-note">${round.note}</span>
  </div>`;

export const foldedStates = (names: string[]) =>
  html`<div class="sk-fold" data-kind="states">
    ${chevron}
    <span class="sk-fold-note">${names.length} Zustand in keiner Variante geändert: ${names.join(', ')}</span>
  </div>`;

export type PageVariant = { key: 'current' | 'a' | 'b'; label: string; note: string; author?: Variant['author'] };

export const PAGE_SKETCH = { part: 'pages/system', status: 'In Arbeit', state: 'part' };

export const PAGE_ROUND: Round = { key: 'r1', title: 'Mehr Platz für die Leinwand', note: '', variants: ['a', 'b'] };

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

export const NO_CONTEXT = 'Im Kontext entfällt: eine Page ist ihr eigener Kontext.';
