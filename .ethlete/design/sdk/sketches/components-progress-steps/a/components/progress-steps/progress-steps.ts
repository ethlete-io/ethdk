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
  note: 'The SDK progress steps (et-progress-steps with et-progress-step), drawn by their mock from @ethlete/components/design: a row (or column) of 24px round markers joined by a 2px connector, each with a 14px label. An upcoming step shows its CSS counter number in the muted surface text inside a surface-border ring; the current step rings its marker in the primary theme colour, its number in ink and its label in the full text at weight 600; complete fills the marker in primary with a check in on-primary and fills the connector after it. success, warning and error force the app semantic theme (warning and danger here; this product registers no success theme, so success keeps the brand theme) and swap in a check, a triangle or a cross, with the label in ink at weight 600. An optional 12px muted description sits under the label. Written as a link or button, the whole step is the target: hover rings the marker in primary and lifts the label to the full text; focus-visible draws the 2px primary focus ring 3px out.',
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
  render: (props: Props) =>
    drawing({
      body: `<div class="progress-steps-frame">${steps(props)}</div>`,
      styles: [progressStepsStyles, frame].join('\n'),
    }),
});
