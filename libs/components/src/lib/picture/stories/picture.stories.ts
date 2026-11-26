import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { PictureComponent } from '../picture.component';
import { PictureFitStorybookComponent } from './picture-fit-storybook.component';
import { PictureFormatsStorybookComponent } from './picture-formats-storybook.component';
import { PictureStorybookComponent } from './picture-storybook.component';

export default {
  title: 'Components/Media/Picture',
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
          'first image swap crop - that is a `media` query on a `<source>`, which no `srcset` can express.',
      },
    },
  },
};

export const Fit: StoryObj<PictureFitStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [PictureFitStorybookComponent] })],
  render: () => ({ template: '<et-sb-picture-fit />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Every `fit` mode against one 16:9 source in a fixed 180x120 box, plus the natural size the browser ' +
          'reports back once it has decoded the image.',
      },
    },
  },
};

export const FormatsAndDensity: StoryObj<PictureFormatsStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [PictureFormatsStorybookComponent] })],
  render: () => ({ template: '<et-sb-picture-formats />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Sources that differ by `type` and by density descriptor. The browser skips a type it cannot decode, ' +
          'then picks the `1x` or `2x` candidate of the first supported source by device pixel ratio.',
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

export const HoverZoom: StoryObj = {
  decorators: [moduleMetadata({ imports: [PictureComponent] })],
  render: () => ({
    template: `
      <div class="group max-w-[520px] p-8">
        <et-picture
          data-testid="zoom-host"
          class="block [--et-picture-img-transform:none] [--et-picture-img-transition:transform_300ms_ease] group-hover:[--et-picture-img-transform:scale(1.15)]"
          defaultSrc="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect width='640' height='360' fill='%23557'/%3E%3Ccircle cx='320' cy='180' r='90' fill='%23fc6'/%3E%3C/svg%3E"
          [aspectRatio]="16 / 9"
          alt="A coloured block"
        />
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Set `--et-picture-img-transform` and `--et-picture-img-transition` to zoom only the image; ' +
          'the picture clips it and the box keeps its size.',
      },
    },
  },
};
