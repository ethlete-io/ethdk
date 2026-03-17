import { Meta, StoryFn } from '@storybook/angular';
import { VimeoPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Vimeo',
  component: VimeoPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    videoId: 76979871,
    width: '100%',
    height: 360,
  },
} as Meta<VimeoPlayerStorybookComponent>;

const Template: StoryFn<VimeoPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
