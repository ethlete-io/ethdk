import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { PictureStorybookComponent } from './picture-storybook.component';

export default {
  title: 'Components/Picture',
  component: PictureStorybookComponent,
  decorators: [moduleMetadata({ imports: [PictureStorybookComponent] })],
  args: { surface: 'dark', showCaption: true, ratio: '16 / 9' },
  argTypes: {
    surface: { control: 'text' },
    showCaption: { control: 'boolean' },
    ratio: { control: 'radio', options: ['16 / 9', '4 / 3', 'none'] },
  },
} as Meta<PictureStorybookComponent>;

type Story = StoryObj<PictureStorybookComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Art direction, a loading placeholder and an error slot. Resize the preview past 700px to see the ' +
          'first image swap crop — that is a `media` query on a `<source>`, which no `srcset` can express.',
      },
    },
  },
};

export const NoAspectRatio: Story = {
  args: { ratio: 'none' },
  parameters: {
    docs: {
      description: {
        story:
          'Without `aspectRatio` (and without `width`/`height`) the box has no size until the image arrives, ' +
          'so the page shifts when it does. Worth seeing once, then never shipping.',
      },
    },
  },
};
