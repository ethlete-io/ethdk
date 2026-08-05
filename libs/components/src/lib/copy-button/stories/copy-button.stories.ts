import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CopyButtonStorybookComponent } from './copy-button-storybook.component';

export default {
  title: 'Components/Copy button',
  component: CopyButtonStorybookComponent,
  decorators: [moduleMetadata({ imports: [CopyButtonStorybookComponent] })],
  args: {
    text: 'npm install @ethlete/components',
  },
} as Meta<CopyButtonStorybookComponent>;

type Story = StoryObj<CopyButtonStorybookComponent>;

export const Default: Story = {};
