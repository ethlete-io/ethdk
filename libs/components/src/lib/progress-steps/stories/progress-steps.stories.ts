import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ProgressStepsStorybookComponent } from './progress-steps-storybook.component';

export default {
  title: 'Components/Progress steps',
  component: ProgressStepsStorybookComponent,
  decorators: [moduleMetadata({ imports: [ProgressStepsStorybookComponent] })],
} as Meta<ProgressStepsStorybookComponent>;

type Story = StoryObj<ProgressStepsStorybookComponent>;

export const Default: Story = {};
