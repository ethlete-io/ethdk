import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayRoutingStorybookComponent } from './components';

@Component({
  selector: 'et-sb-routing-catch-all',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RoutingCatchAllComponent {}

export default {
  title: 'Components/Overlay/Routing',
  component: OverlayRoutingStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [OverlayRoutingStorybookComponent] }),
    applicationConfig({
      providers: [
        provideOverlay(),
        // Provided so `syncUrl: true` router configs work in the story; in-memory routing needs nothing.
        provideRouter([{ path: '**', component: RoutingCatchAllComponent }], withHashLocation()),
      ],
    }),
  ],
} as Meta<OverlayRoutingStorybookComponent>;

type Story = StoryObj<OverlayRoutingStorybookComponent>;

export const Default: Story = {};
