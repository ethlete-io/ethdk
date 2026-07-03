import { provideRouter, withHashLocation } from '@angular/router';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayHandlerStorybookComponent } from './components';

export default {
  title: 'Components/Overlay/Handlers',
  component: OverlayHandlerStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [OverlayHandlerStorybookComponent] }),
    applicationConfig({
      providers: [provideOverlay(), provideRouter([], withHashLocation())],
    }),
  ],
} as Meta<OverlayHandlerStorybookComponent>;

type Story = StoryObj<OverlayHandlerStorybookComponent>;

export const Default: Story = {};
