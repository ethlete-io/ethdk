import { provideRouter, withHashLocation } from '@angular/router';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayOpenerStorybookComponent } from './components';

export default {
  title: 'Components/Overlays/Overlay/Using Openers',
  component: OverlayOpenerStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [OverlayOpenerStorybookComponent] }),
    applicationConfig({
      providers: [provideOverlay(), provideRouter([], withHashLocation())],
    }),
  ],
} as Meta<OverlayOpenerStorybookComponent>;

type Story = StoryObj<OverlayOpenerStorybookComponent>;

export const Default: Story = {};
