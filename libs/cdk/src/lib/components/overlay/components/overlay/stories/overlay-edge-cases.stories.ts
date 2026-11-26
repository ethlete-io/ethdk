import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OpenFromEffectHostComponent } from './components/overlay-edge-cases-host.component';

export default {
  title: 'CDK/Overlay/Overlay/Edge Cases',
  component: OpenFromEffectHostComponent,
  decorators: [
    applicationConfig({
      providers: [provideOverlay(), provideRouter([], withHashLocation())],
    }),
  ],
} as Meta<OpenFromEffectHostComponent>;

const Template: StoryFn<OpenFromEffectHostComponent> = (args) => ({ props: args });

/** Demonstrates that calling `overlayManager.open()` from inside an `effect()` works without throwing NG0602 or NG0600. */
export const OpenFromEffect = {
  render: Template,
  args: {},
};
