import { provideRouter, withHashLocation } from '@angular/router';
import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { BreadcrumbService } from '../services/breadcrumb.service';
import CustomMDXDocumentation from './breadcrumb.docs.mdx';
import { StorybookBreadcrumbComponent } from './components';
import {
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
        BreadcrumbService,
        provideRouter(
          [
            { path: 'one', component: RouterOneComponent },
            { path: 'two', component: RouterTwoComponent },
            { path: 'three', component: RouterThreeComponent },
            { path: 'four', component: RouterFourComponent },
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
