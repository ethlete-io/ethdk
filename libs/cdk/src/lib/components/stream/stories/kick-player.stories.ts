import { Meta, StoryFn } from '@storybook/angular';
import { KickPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Kick',
  component: KickPlayerStorybookComponent,
  argTypes: {
    channel: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    channel: 'asmongold247',
    width: '100%',
    height: 360,
  },
} as Meta<KickPlayerStorybookComponent>;

const Template: StoryFn<KickPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const LiveStream = {
  render: Template,
};
