import { emptyState, emptyStateStyles } from '@ethlete/components/design/empty-state';
import { definePart, drawing } from '@design-system';
import frame from './empty-state.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  form: 'default' | 'without-action' | 'errored' | 'heading-only';
  action?: Interaction;
};

const mark = (interaction?: Interaction) =>
  [`data-et-control="action" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const COPY = {
  default: {
    heading: 'No results',
    description: 'Try a different search term or clear your filters.',
    action: 'Clear filters',
  },
  'without-action': { heading: 'No results', description: 'Try a different search term or clear your filters.' },
  errored: {
    icon: 'triangle',
    heading: 'Something went wrong',
    description: 'We could not load this data. Please try again.',
    action: 'Try again',
  },
  'heading-only': { icon: false, heading: 'Nothing here yet' },
} as const;

const render = ({ form, action }: Props) => emptyState({ ...COPY[form], actionAttributes: mark(action) });

export default definePart({
  note: 'The SDK empty state (et-empty-state), drawn by its mock from @ethlete/components/design on the page: a centred flex column (32px padding, 8px gap, at most 320px wide) with a 32px projected icon in the muted surface text, a 14px title at weight 600 in the full surface text, a 13px description in the muted surface text and an optional projected action, here the default filled md et-button 8px below. The empty state has no colour, hover or focus of its own; only the action button has states.',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: { form: 'default' },
    'without-action': { form: 'without-action' },
    errored: { form: 'errored' },
    'heading-only': { form: 'heading-only' },
    'action-hover': { form: 'default', action: 'hover' },
    'action-active': { form: 'default', action: 'active' },
    'action-focus-visible': { form: 'default', action: 'focus-visible' },
  },
  widths: [480],
  controls: {
    action: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="empty-state-frame">${render(props)}</div>`,
      styles: [emptyStateStyles, frame].join('\n'),
    }),
});
