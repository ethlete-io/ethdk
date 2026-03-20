import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import { OverlayShowcaseHostComponent } from './components/overlay-showcase-host.component';
import CustomMDXDocumentation from './overlay.docs.mdx';

export default {
  title: 'CDK/Overlay/Overlay/Strategies & Responsive',
  component: OverlayShowcaseHostComponent,
  decorators: [
    applicationConfig({
      providers: [provideOverlay(), provideRouter([], withHashLocation())],
    }),
  ],
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<OverlayShowcaseHostComponent>;

const Template: StoryFn<OverlayShowcaseHostComponent> = (args) => ({ props: args });

export const Default = {
  render: Template,
  args: {},
};
