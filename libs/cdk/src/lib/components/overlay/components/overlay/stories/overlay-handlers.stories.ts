import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayHandlerHostComponent } from './components/overlay-handler-host.component';

export default {
  title: 'CDK/Overlay/Overlay/Handlers',
  component: OverlayHandlerHostComponent,
  decorators: [
    applicationConfig({
      providers: [provideOverlay(), provideRouter([], withHashLocation())],
    }),
  ],
} as Meta<OverlayHandlerHostComponent>;

const Template: StoryFn<OverlayHandlerHostComponent> = (args) => ({ props: args });

export const Handler = {
  render: Template,
  args: {},
  name: 'createOverlayHandler',
};
