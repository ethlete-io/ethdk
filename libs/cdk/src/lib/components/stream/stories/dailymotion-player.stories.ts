import { Meta, StoryFn } from '@storybook/angular';
import { DailymotionPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Dailymotion',
  component: DailymotionPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    videoId: 'x84sh87',
    width: '100%',
    height: 360,
  },
} as Meta<DailymotionPlayerStorybookComponent>;

const Template: StoryFn<DailymotionPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
