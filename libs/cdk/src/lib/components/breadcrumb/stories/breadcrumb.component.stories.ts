import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideBreadcrumbManager } from '../providers/breadcrumb-manager.provider';
import CustomMDXDocumentation from './breadcrumb.docs.mdx';
import { StorybookBreadcrumbComponent } from './components';
import {
  RouterFiveComponent,
  RouterFourComponent,
  RouterOneComponent,
  RouterThreeComponent,
  RouterTwoComponent,
} from './components/router-components';

export default {
  title: 'CDK/Breadcrumb',
  component: StorybookBreadcrumbComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideBreadcrumbManager(),
        provideRouter(
          [
            { path: 'one', component: RouterOneComponent },
            { path: 'two', component: RouterTwoComponent },
            { path: 'three', component: RouterThreeComponent },
            { path: 'four', component: RouterFourComponent },
            { path: 'five', component: RouterFiveComponent },
          ],
          withHashLocation(),
        ),
      ],
    }),
  ],
  args: {},
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookBreadcrumbComponent>;

const Template: StoryFn<StorybookBreadcrumbComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
