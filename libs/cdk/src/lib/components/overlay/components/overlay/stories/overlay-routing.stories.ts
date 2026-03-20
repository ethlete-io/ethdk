import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import {
  OverlayRoutingHostComponent,
  RoutingStorybookRouteComponent,
} from './components/overlay-routing-host.component';

export default {
  title: 'CDK/Overlay/Overlay/Routing',
  component: OverlayRoutingHostComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideOverlay(),
        provideRouter([{ path: '**', component: RoutingStorybookRouteComponent }], withHashLocation()),
      ],
    }),
  ],
} as Meta<OverlayRoutingHostComponent>;

const Template: StoryFn<OverlayRoutingHostComponent> = (args) => ({ props: args });

export const Default = {
  render: Template,
  args: {},
};
