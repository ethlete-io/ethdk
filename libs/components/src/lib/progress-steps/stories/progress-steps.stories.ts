import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ProgressStepsStorybookComponent, ProgressStepsStorybookStep } from './progress-steps-storybook.component';

export default {
  title: 'Components/Progress steps',
  component: ProgressStepsStorybookComponent,
  decorators: [moduleMetadata({ imports: [ProgressStepsStorybookComponent] })],
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    asLinks: { control: 'boolean' },
  },
  args: { orientation: 'horizontal', asLinks: false },
} as Meta<ProgressStepsStorybookComponent>;

type Story = StoryObj<ProgressStepsStorybookComponent>;

export const Default: Story = {};

export const Outcomes: Story = {
  args: {
    steps: [
      { label: 'Upload', state: 'success' },
      { label: 'Validate', state: 'warning' },
      { label: 'Import', state: 'error' },
      { label: 'Publish', state: 'upcoming' },
    ],
  },
};

/** A column instead of a row: the connector hangs from each marker down to the next one. */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
};

/**
 * Steps a user can go back to. Writing the step as an `<a>` (or a `<button>`) puts it on the
 * consumer's own element, so `routerLink` and click handlers stay theirs - the step only adds the
 * hover and focus treatment.
 */
export const AsLinks: Story = {
  args: { asLinks: true },
};

export const VerticalLinks: Story = {
  args: { orientation: 'vertical', asLinks: true },
};

const DESCRIBED_STEPS: ProgressStepsStorybookStep[] = [
  { label: 'Account', state: 'complete', description: 'sam@example.com' },
  { label: 'Shipping', state: 'complete', description: 'Standard, 2-4 days' },
  { label: 'Payment', state: 'current', description: 'Card ending 4242' },
  { label: 'Review', state: 'upcoming', description: 'Confirm and place the order' },
];

/**
 * A second, muted line under the label - projected as `[etProgressStepDescription]`, so it can hold
 * a link or emphasis rather than just a string. A column gives it room to read.
 */
export const VerticalDescriptions: Story = {
  args: { orientation: 'vertical', steps: DESCRIBED_STEPS },
};

/** The same slot in a row. It works, but each description is as narrow as its step. */
export const Descriptions: Story = {
  args: { steps: DESCRIBED_STEPS },
};
