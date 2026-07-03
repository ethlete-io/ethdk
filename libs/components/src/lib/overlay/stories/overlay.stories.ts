import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayStorybookComponent } from './components';

export default {
  title: 'Components/Overlay',
  component: OverlayStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [OverlayStorybookComponent] }),
    applicationConfig({ providers: [provideOverlay()] }),
  ],
} as Meta<OverlayStorybookComponent>;

type Story = StoryObj<OverlayStorybookComponent>;

export const Default: Story = {};
