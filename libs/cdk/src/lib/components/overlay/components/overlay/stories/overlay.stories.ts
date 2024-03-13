import { provideRouter, withHashLocation } from '@angular/router';
import { Meta, StoryFn, applicationConfig } from '@storybook/angular';
import { provideOverlay } from '../overlay.imports';
import {
  OverlayHostStorybookComponent,
  StorybookExampleService,
  StorybookOverlayHostRouteComponent,
} from './components';
import CustomMDXDocumentation from './overlay.docs.mdx';

export default {
  title: 'CDK/Overlay/Overlay',
  component: StorybookOverlayHostRouteComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideOverlay(),
        provideRouter(
          [
            {
              pathMatch: 'full',
              path: '',
              component: OverlayHostStorybookComponent,
              providers: [StorybookExampleService],
            },
          ],
          withHashLocation(),
        ),
      ],
    }),
  ],
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookOverlayHostRouteComponent>;

const Template: StoryFn<StorybookOverlayHostRouteComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
