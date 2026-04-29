import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { IconStorybookComponent } from './components';

export default {
  title: 'Components/Icon',
  component: IconStorybookComponent,
  decorators: [moduleMetadata({ imports: [IconStorybookComponent] })],
} as Meta<IconStorybookComponent>;

type Story = StoryObj<IconStorybookComponent>;

export const Default: Story = {};
