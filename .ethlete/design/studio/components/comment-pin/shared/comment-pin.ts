import { type Agent, agentLogo } from './agent-logos';

export type PinInteraction = 'hover' | 'focus-visible' | 'active';

export type Props = {
  author: string;
  initials?: string;
  agent?: Agent;
  count?: number;
  selected?: boolean;
  interaction?: PinInteraction;
};

const label = ({ author, count }: Props) =>
  count && count > 1 ? `Comment by ${author}, ${count} messages` : `Comment by ${author}`;

const face = (p: Props) =>
  p.agent
    ? `<span class="st-pin-face" data-agent>${agentLogo(p.agent, 'st-pin-logo')}</span>`
    : `<span class="st-pin-face">${p.initials ?? ''}</span>`;

export const pin = (p: Props) =>
  `<span class="st-pin-stage"><button
        type="button"
        class="st-pin"
        aria-label="${label(p)}"
        ${p.selected ? 'aria-pressed="true" data-selected' : ''}
        ${p.interaction ? `data-et-force="${p.interaction}"` : ''}
      >${face(p)}${p.count && p.count > 1 ? `<span class="st-pin-count">${p.count}</span>` : ''}</button></span>`;

const tom: Props = { author: 'Tom', initials: 'TB' };
const claude: Props = { author: 'Claude', agent: 'claude' };

const hover = 'hover' as const;
const active = 'active' as const;
const focus = 'focus-visible' as const;
const selectedTom: Props = { ...tom, selected: true };
const selectedClaude: Props = { ...claude, selected: true };

export const states = {
  initials: tom,
  'initials-hover': { ...tom, interaction: hover },
  'initials-active': { ...tom, interaction: active },
  'initials-focus-visible': { ...tom, interaction: focus },
  logo: claude,
  'logo-hover': { ...claude, interaction: hover },
  'logo-active': { ...claude, interaction: active },
  'logo-focus-visible': { ...claude, interaction: focus },
  selected: selectedTom,
  'selected-hover': { ...selectedTom, interaction: hover },
  'selected-active': { ...selectedTom, interaction: active },
  'selected-focus-visible': { ...selectedTom, interaction: focus },
  'selected-logo': selectedClaude,
  'selected-logo-hover': { ...selectedClaude, interaction: hover },
  'selected-logo-active': { ...selectedClaude, interaction: active },
  'selected-logo-focus-visible': { ...selectedClaude, interaction: focus },
  count: { ...tom, count: 3 },
  'logo-count': { ...claude, count: 3 },
  'selected-count': { ...selectedTom, count: 3 },
  'selected-logo-count': { ...selectedClaude, count: 3 },
} satisfies Record<string, Props>;

export const grid = {
  columns: ['rest', 'hover', 'active', 'focus-visible'],
  rows: {
    initials: {
      rest: 'initials',
      hover: 'initials-hover',
      active: 'initials-active',
      'focus-visible': 'initials-focus-visible',
    },
    logo: { rest: 'logo', hover: 'logo-hover', active: 'logo-active', 'focus-visible': 'logo-focus-visible' },
    selected: {
      rest: 'selected',
      hover: 'selected-hover',
      active: 'selected-active',
      'focus-visible': 'selected-focus-visible',
    },
    'selected-logo': {
      rest: 'selected-logo',
      hover: 'selected-logo-hover',
      active: 'selected-logo-active',
      'focus-visible': 'selected-logo-focus-visible',
    },
    count: { rest: 'count' },
    'logo-count': { rest: 'logo-count' },
    'selected-count': { rest: 'selected-count' },
    'selected-logo-count': { rest: 'selected-logo-count' },
  },
} as const satisfies { columns: readonly string[]; rows: Record<string, Record<string, keyof typeof states>> };
