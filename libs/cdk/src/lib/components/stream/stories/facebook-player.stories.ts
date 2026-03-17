import { Meta, StoryFn } from '@storybook/angular';
import { FacebookPlayerStorybookComponent } from './components';

export default {
  title: 'CDK/Stream/Facebook',
  component: FacebookPlayerStorybookComponent,
  argTypes: {
    videoId: { control: { type: 'text' } },
    width: { control: { type: 'text' } },
    height: { control: { type: 'number' } },
  },
  args: {
    videoId: '10155364627206729',
    width: '100%',
    height: 360,
  },
} as Meta<FacebookPlayerStorybookComponent>;

const Template: StoryFn<FacebookPlayerStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};

export const WithError = {
  render: Template,
  args: {
    videoId: 'INVALID_VIDEO_ID',
  },
};
