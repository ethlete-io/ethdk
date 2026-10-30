import { forceInteraction, interactionRows } from '@design-system';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';

type PinInteraction = 'hover' | 'focus-visible' | 'active';

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

type CountPlacement = 'beside' | 'inside';

const face = (p: Props, inner = '') =>
  p.agent
    ? `<span class="st-pin-face" data-agent>${agentLogo(p.agent, 'st-pin-logo')}${inner}</span>`
    : `<span class="st-pin-face">${p.initials ?? ''}${inner}</span>`;

const countBadge = ({ count }: Props) => (count && count > 1 ? `<span class="st-pin-count">${count}</span>` : '');

export const pin = (p: Props, placement: CountPlacement = 'beside') => {
  const markup = `<button
        type="button"
        class="st-pin"
        aria-label="${label(p)}"
        ${p.selected ? 'aria-pressed="true" data-selected' : ''}
      >${placement === 'inside' ? face(p, countBadge(p)) : `${face(p)}${countBadge(p)}`}</button>`;

  return p.interaction ? forceInteraction(markup, p.interaction) : markup;
};

const tom: Props = { author: 'Tom', initials: 'TB' };
const claude: Props = { author: 'Claude', agent: 'claude' };
const selectedTom: Props = { ...tom, selected: true };
const selectedClaude: Props = { ...claude, selected: true };

export const { states, grid } = interactionRows(
  {
    initials: tom,
    logo: claude,
    selected: selectedTom,
    'selected-logo': selectedClaude,
    count: { ...tom, count: 3 },
    'logo-count': { ...claude, count: 3 },
    'selected-count': { ...selectedTom, count: 3 },
    'selected-logo-count': { ...selectedClaude, count: 3 },
    'count-12': { ...tom, count: 12 },
    'selected-logo-count-12': { ...selectedClaude, count: 12 },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);
