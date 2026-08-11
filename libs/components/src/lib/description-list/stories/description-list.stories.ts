import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { DescriptionListStorybookComponent } from './description-list-storybook.component';

export default {
  title: 'Components/Description list',
  component: DescriptionListStorybookComponent,
  decorators: [moduleMetadata({ imports: [DescriptionListStorybookComponent] })],
  args: { variant: 'inline' },
  argTypes: { variant: { control: 'select', options: ['inline', 'stacked'] } },
} as Meta<DescriptionListStorybookComponent>;

type Story = StoryObj<DescriptionListStorybookComponent>;

export const Default: Story = {};

export const Stacked: Story = {
  args: { variant: 'stacked' },
};
