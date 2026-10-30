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

const faceBase =
  'flex size-5.5 items-center justify-center rounded-[50%_50%_50%_0] text-ui-xs font-ui-strong leading-none group-focus-visible/pin:outline-2 group-focus-visible/pin:outline-focus-ring';

const faceClass = ({ agent, selected }: Props) => {
  const pressed =
    'group-active/pin:bg-surface-raised group-active/pin:bg-[linear-gradient(var(--surface-pressed),var(--surface-pressed))]';

  if (!selected) {
    return `${faceBase} bg-surface-overlay ring-1 ring-surface-border group-hover/pin:bg-surface-raised group-hover/pin:text-text group-hover/pin:ring-text-muted ${pressed} group-focus-visible/pin:outline-offset-2`;
  }

  const rings =
    'ring-2 shadow-[0_0_0_4px_var(--accent-subtle)] text-on-accent group-focus-visible/pin:outline-offset-[5px]';

  return agent
    ? `${faceBase} bg-surface-overlay ring-accent ${rings} group-hover/pin:bg-surface-raised ${pressed}`
    : `${faceBase} bg-accent ring-surface ${rings} group-hover/pin:bg-accent-hover group-active/pin:bg-(--accent-active)`;
};

const face = (p: Props, inner = '') =>
  p.agent
    ? `<span class="${faceClass(p)}">${agentLogo(p.agent, 'size-3')}${inner}</span>`
    : `<span class="${faceClass(p)}">${p.initials ?? ''}${inner}</span>`;

const countBadge = ({ count }: Props) =>
  count && count > 1
    ? `<span class="absolute -top-1.5 left-4.5 box-border flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-ui-xs font-ui-strong leading-none text-on-accent tabular-nums ring-2 ring-surface">${count}</span>`
    : '';

export const pin = (p: Props, placement: CountPlacement = 'beside') => {
  const markup = `<button
        type="button"
        class="group/pin relative inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 text-text-muted focus-visible:outline-none"
        aria-label="${label(p)}"
        ${p.selected ? 'aria-pressed="true"' : ''}
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
