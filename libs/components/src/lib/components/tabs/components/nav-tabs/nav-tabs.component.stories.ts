import { A11yModule } from '@angular/cdk/a11y';
import { ObserversModule } from '@angular/cdk/observers';
import { PortalModule } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Meta, Story, applicationConfig, moduleMetadata } from '@storybook/angular';
import CustomMDXDocumentation from './nav-tabs.component.docs.mdx';
import { TabNavPanelStorybookComponent } from './storybook/nav-tabs-storybook.component';
import {
  RouterFourComponent,
  RouterOneComponent,
  RouterThreeComponent,
  RouterTwoComponent,
} from './storybook/router-components';

export default {
  title: 'Components/Tabs/Navigation',
  component: TabNavPanelStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        PortalModule,
        ObserversModule,
        A11yModule,
        RouterTestingModule.withRoutes([
          { path: 'one', component: RouterOneComponent },
          { path: 'two', component: RouterTwoComponent },
          { path: 'three', component: RouterThreeComponent },
          { path: 'four', component: RouterFourComponent },
        ]),
      ],
    }),
    applicationConfig({
      providers: [provideAnimations()],
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
