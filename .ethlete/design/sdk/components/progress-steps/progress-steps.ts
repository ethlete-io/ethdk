import { progressSteps, ProgressStepMockStep, progressStepsStyles } from '@ethlete/components/design/progress-steps';
import { definePart, drawing } from '@design-system';
import frame from './progress-steps.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  set?: 'checkout' | 'outcomes' | 'described' | 'vertical' | 'links';
  complete?: Interaction;
  upcoming?: Interaction;
};

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}"`, interaction && `data-et-force="${interaction}"`].filter(Boolean).join(' ');

const checkout: ProgressStepMockStep[] = [
  { label: 'Account', state: 'complete' },
  { label: 'Shipping', state: 'current' },
  { label: 'Payment' },
  { label: 'Review' },
];

const outcomes: ProgressStepMockStep[] = [
  { label: 'Upload', state: 'success' },
  { label: 'Validate', state: 'warning', color: 'warning' },
  { label: 'Import', state: 'error', color: 'danger' },
  { label: 'Publish' },
];

const described: ProgressStepMockStep[] = [
  { label: 'Team', state: 'complete', description: '18 players' },
  { label: 'Squad', state: 'error', color: 'danger', description: '2 missing' },
  { label: 'Kit', state: 'current', description: 'Home colours' },
  { label: 'Submit', description: 'By Friday' },
];

const vertical: ProgressStepMockStep[] = [
  { label: 'Registration received', state: 'complete', description: 'Mon, 12 Oct' },
  { label: 'Documents checked', state: 'warning', color: 'warning', description: 'Photo is blurry' },
  { label: 'Payment', state: 'current', description: 'Waiting for the transfer' },
  { label: 'Licence issued' },
];

const links = (props: Props): ProgressStepMockStep[] => [
  { label: 'Account', state: 'complete', as: 'a', attributes: mark('complete', props.complete) },
  { label: 'Shipping', state: 'current', as: 'a' },
  { label: 'Payment', as: 'a', attributes: mark('upcoming', props.upcoming) },
  { label: 'Review', as: 'a' },
];

const steps = (props: Props) => {
  switch (props.set) {
    case 'outcomes':
      return progressSteps({ steps: outcomes });
    case 'described':
      return progressSteps({ steps: described });
    case 'vertical':
      return progressSteps({ steps: vertical, orientation: 'vertical' });
    case 'links':
      return progressSteps({ steps: links(props) });
    default:
      return progressSteps({ steps: checkout });
  }
};

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    outcomes: { set: 'outcomes' },
    described: { set: 'described' },
    vertical: { set: 'vertical' },
    links: { set: 'links' },
    'upcoming-hover': { set: 'links', upcoming: 'hover' },
    'upcoming-active': { set: 'links', upcoming: 'active' },
    'upcoming-focus-visible': { set: 'links', upcoming: 'focus-visible' },
    'complete-hover': { set: 'links', complete: 'hover' },
    'complete-focus-visible': { set: 'links', complete: 'focus-visible' },
  },
  widths: [480],
  controls: {
    complete: { kind: 'button', input: ['pointer', 'keyboard'] },
    upcoming: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  frame: (body) => `<div class="progress-steps-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: steps(props),
      styles: [progressStepsStyles, frame].join('\n'),
    }),
});
