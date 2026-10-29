import { type Agent, agentLogo } from '@system/foundations/agent-logos';

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

export type CountPlacement = 'beside' | 'inside';

const face = (p: Props, inner = '') =>
  p.agent
    ? `<span class="st-pin-face" data-agent>${agentLogo(p.agent, 'st-pin-logo')}${inner}</span>`
    : `<span class="st-pin-face">${p.initials ?? ''}${inner}</span>`;

const countBadge = ({ count }: Props) => (count && count > 1 ? `<span class="st-pin-count">${count}</span>` : '');

export const pin = (p: Props, placement: CountPlacement = 'beside') =>
  `<button
        type="button"
        class="st-pin"
        aria-label="${label(p)}"
        ${p.selected ? 'aria-pressed="true" data-selected' : ''}
        ${p.interaction ? `data-et-force="${p.interaction}"` : ''}
      >${placement === 'inside' ? face(p, countBadge(p)) : `${face(p)}${countBadge(p)}`}</button>`;

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
  'count-hover': { ...tom, count: 3, interaction: hover },
  'count-active': { ...tom, count: 3, interaction: active },
  'count-focus-visible': { ...tom, count: 3, interaction: focus },
  'logo-count': { ...claude, count: 3 },
  'logo-count-hover': { ...claude, count: 3, interaction: hover },
  'logo-count-active': { ...claude, count: 3, interaction: active },
  'logo-count-focus-visible': { ...claude, count: 3, interaction: focus },
  'selected-count': { ...selectedTom, count: 3 },
  'selected-count-hover': { ...selectedTom, count: 3, interaction: hover },
  'selected-count-active': { ...selectedTom, count: 3, interaction: active },
  'selected-count-focus-visible': { ...selectedTom, count: 3, interaction: focus },
  'selected-logo-count': { ...selectedClaude, count: 3 },
  'selected-logo-count-hover': { ...selectedClaude, count: 3, interaction: hover },
  'selected-logo-count-active': { ...selectedClaude, count: 3, interaction: active },
  'selected-logo-count-focus-visible': { ...selectedClaude, count: 3, interaction: focus },
  'count-12': { ...tom, count: 12 },
  'count-12-hover': { ...tom, count: 12, interaction: hover },
  'count-12-active': { ...tom, count: 12, interaction: active },
  'count-12-focus-visible': { ...tom, count: 12, interaction: focus },
  'selected-logo-count-12': { ...selectedClaude, count: 12 },
  'selected-logo-count-12-hover': { ...selectedClaude, count: 12, interaction: hover },
  'selected-logo-count-12-active': { ...selectedClaude, count: 12, interaction: active },
  'selected-logo-count-12-focus-visible': { ...selectedClaude, count: 12, interaction: focus },
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
    count: {
      rest: 'count',
      hover: 'count-hover',
      active: 'count-active',
      'focus-visible': 'count-focus-visible',
    },
    'logo-count': {
      rest: 'logo-count',
      hover: 'logo-count-hover',
      active: 'logo-count-active',
      'focus-visible': 'logo-count-focus-visible',
    },
    'selected-count': {
      rest: 'selected-count',
      hover: 'selected-count-hover',
      active: 'selected-count-active',
      'focus-visible': 'selected-count-focus-visible',
    },
    'selected-logo-count': {
      rest: 'selected-logo-count',
      hover: 'selected-logo-count-hover',
      active: 'selected-logo-count-active',
      'focus-visible': 'selected-logo-count-focus-visible',
    },
    'count-12': {
      rest: 'count-12',
      hover: 'count-12-hover',
      active: 'count-12-active',
      'focus-visible': 'count-12-focus-visible',
    },
    'selected-logo-count-12': {
      rest: 'selected-logo-count-12',
      hover: 'selected-logo-count-12-hover',
      active: 'selected-logo-count-12-active',
      'focus-visible': 'selected-logo-count-12-focus-visible',
    },
  },
} as const satisfies { columns: readonly string[]; rows: Record<string, Record<string, keyof typeof states>> };
