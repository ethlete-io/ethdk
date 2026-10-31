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

const shape = 'rounded-[50%_50%_50%_0]';

const pinBase = `group/pin relative inline-flex size-5.5 cursor-pointer items-center justify-center ${shape} border-0 p-0 text-ui-xs font-ui-strong leading-none focus-visible:outline-2 focus-visible:outline-focus-ring`;

const pinClass = ({ agent, selected }: Props) => {
  if (!selected) {
    return `${pinBase} bg-et-surface-bg text-text-muted ring-1 ring-et-surface-border hover:text-text hover:ring-text-muted active:text-text focus-visible:outline-offset-2`;
  }

  const rings =
    'ring-2 shadow-[0_0_0_4px_rgb(var(--et-theme-color-primary-rgb)/0.2)] text-et-on-theme focus-visible:outline-offset-[5px]';

  return agent
    ? `${pinBase} bg-et-surface-bg ring-et-theme ${rings}`
    : `${pinBase} bg-et-theme ring-et-surface-bg ${rings} hover:bg-et-theme-hover active:bg-et-theme-active`;
};

const faceClass = ({ agent, selected }: Props) =>
  `flex size-full items-center justify-center ${shape}${selected && !agent ? '' : ' group-hover/pin:bg-et-surface-interaction/9 group-active/pin:bg-et-surface-interaction/15'}`;

const face = (p: Props, inner = '') =>
  `<span class="${faceClass(p)}">${p.agent ? agentLogo(p.agent, 'size-3') : (p.initials ?? '')}${inner}</span>`;

const countBadge = ({ count }: Props) =>
  count && count > 1
    ? `<span aria-hidden="true" class="absolute -top-1.5 left-4.5 box-border flex h-4 min-w-4 items-center justify-center rounded-pill bg-et-theme px-1 text-ui-xs font-ui-strong leading-none text-et-on-theme tabular-nums ring-2 ring-et-surface-bg">${count}</span>`
    : '';

export const pin = (p: Props, placement: CountPlacement = 'beside') => {
  const badge = countBadge(p);
  const inside = placement === 'inside';
  const markup = `<button
        type="button"
        class="${pinClass(p)}"
        ${p.selected && !p.agent ? '' : 'data-et-auto-surface'}
        data-et-surface-interactive
        aria-label="${label(p)}"
        ${p.selected ? 'aria-pressed="true"' : ''}
      >${face(p, inside ? badge : '')}</button>`;
  const button = p.interaction ? forceInteraction(markup, p.interaction) : markup;

  return inside || !badge ? button : `<span class="relative inline-flex">${button}${badge}</span>`;
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
