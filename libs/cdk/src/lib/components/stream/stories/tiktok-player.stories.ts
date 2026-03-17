import { Meta, StoryFn } from '@storybook/angular';
import { TikTokPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/TikTok',
  component: TikTokPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    videoId: '6718335390845095173',
    width: '100%',
    height: 740,
  },
} as Meta<TikTokPlayerStorybookComponent>;

const Template: StoryFn<TikTokPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
