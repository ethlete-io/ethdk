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
  note: 'Decided rules only',
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
  frame: (body) => `<div class="empty-state-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [emptyStateStyles, frame].join('\n'),
    }),
});
