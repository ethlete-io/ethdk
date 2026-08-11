import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ProgressStepsStorybookComponent } from './progress-steps-storybook.component';

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
