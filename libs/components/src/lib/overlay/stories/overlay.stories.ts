import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayStorybookComponent } from './components';

export default {
  title: 'Components/Overlays/Overlay',
  component: OverlayStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [OverlayStorybookComponent] }),
    applicationConfig({ providers: [provideOverlay()] }),
  ],
  argTypes: {
    direction: { control: 'select', options: ['', 'rtl'] },
  },
  args: {
    direction: '',
  },
} as Meta<OverlayStorybookComponent>;

type Story = StoryObj<OverlayStorybookComponent>;

export const Default: Story = {};

export const RightToLeft: Story = {
  args: { direction: 'rtl' },
};
