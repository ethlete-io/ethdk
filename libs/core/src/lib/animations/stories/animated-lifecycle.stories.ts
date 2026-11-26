import { Meta, StoryObj } from '@storybook/angular';
import { AnimatedLifecycleStorybookComponent } from './components';

export default {
  title: 'Core/Animations/Lifecycle',
  component: AnimatedLifecycleStorybookComponent,
  args: { durationMs: 600 },
  argTypes: { durationMs: { control: 'number' } },
} as Meta<AnimatedLifecycleStorybookComponent>;

export const Default: StoryObj<AnimatedLifecycleStorybookComponent> = {};
