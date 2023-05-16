import { importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Meta, Story, applicationConfig } from '@storybook/angular';
import CustomMDXDocumentation from './nav-tabs.component.docs.mdx';
import { TabNavPanelStorybookComponent } from './storybook/nav-tabs-storybook.component';
import {
  RouterFourComponent,
  RouterOneComponent,
  RouterThreeComponent,
  RouterTwoComponent,
} from './storybook/router-components';

export default {
  title: 'CDK/Tabs/Navigation',
  component: TabNavPanelStorybookComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideAnimations(),
        importProvidersFrom(
          RouterTestingModule.withRoutes([
            { path: 'one', component: RouterOneComponent },
            { path: 'two', component: RouterTwoComponent },
            { path: 'three', component: RouterThreeComponent },
            { path: 'four', component: RouterFourComponent },
          ]),
        ),
      ],
    }),
  ],
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta;

const Template: Story = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
