import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayQueryParamHostComponent } from './components/overlay-handler-host.component';

export default {
  title: 'CDK/Overlay/Overlay/Handlers',
  component: OverlayQueryParamHostComponent,
  decorators: [
    applicationConfig({
      providers: [provideOverlay(), provideRouter([], withHashLocation())],
    }),
  ],
} as Meta<OverlayQueryParamHostComponent>;

const Template: StoryFn<OverlayQueryParamHostComponent> = (args) => ({ props: args });

export const QueryParamLifecycle = {
  render: Template,
  args: {},
  name: 'createOverlayHandlerWithQueryParamLifecycle',
};
