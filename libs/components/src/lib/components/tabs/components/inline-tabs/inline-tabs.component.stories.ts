import { A11yModule } from '@angular/cdk/a11y';
import { ObserversModule } from '@angular/cdk/observers';
import { PortalModule } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { InlineTabComponent, InlineTabLabelDirective } from '../../partials';
import { InlineTabsComponent } from './inline-tabs.component';
import CustomMDXDocumentation from './inline-tabs.component.docs.mdx';

export default {
  title: 'Components/Tabs/Inline',
  component: InlineTabsComponent,
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        PortalModule,
        ObserversModule,
        A11yModule,
        BrowserAnimationsModule,
        InlineTabComponent,
        InlineTabLabelDirective,
      ],
    }),
  ],
  argTypes: {
    selectedIndex: {
      control: {
        type: 'number',
      },
      name: 'Selected index',
      description: 'Index of the selected tab',
    },
    contentTabIndex: {
      control: {
        type: 'number',
      },
      name: 'Content tab index',
      description:
        'Tab index to be set on the inner element that wraps the tab content. Can be used for improved accessibility when the tab does not have focusable elements or if it has scrollable content.',
    },
    preserveContent: {
      control: {
        type: 'boolean',
      },
      name: 'Preserve content',
      description: 'If true, the content will not be destroyed when the tab is unselected.',
    },
    tabHeaderClasses: {
      control: {
        type: 'text',
      },
      name: 'Tab header classes (ngClass)',
    },
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<InlineTabsComponent>;

const Template: Story<InlineTabsComponent> = (args) => ({
  props: args,
  template: `
    <et-inline-tabs [selectedIndex]="selectedIndex" [contentTabIndex]="contentTabIndex" [preserveContent]="preserveContent">
        <et-inline-tab label="Tab One">Content 1</et-inline-tab>
        <et-inline-tab label="Other Tab">Content 2</et-inline-tab>
        <et-inline-tab label="One more Tab">Content 3</et-inline-tab>
        <et-inline-tab label="Tab">Content 4</et-inline-tab>
        <et-inline-tab label="Disabled Tab" disabled>Content 5</et-inline-tab>
    </et-inline-tabs>
  `,
});

export const Default = Template.bind({});

Default.args = {
  selectedIndex: null,
  contentTabIndex: null,
  preserveContent: false,
  tabHeaderClasses: '',
};

const TemplateCustomLabel: Story<InlineTabsComponent> = (args) => ({
  props: args,
  template: `
    <et-inline-tabs [selectedIndex]="selectedIndex" [contentTabIndex]="contentTabIndex" [preserveContent]="preserveContent">
        <et-inline-tab>
          <ng-template et-inline-tab-label>
            First
          </ng-template>
  
          Content 1
        </et-inline-tab>
        <et-inline-tab>
          <ng-template et-inline-tab-label>
            Second
          </ng-template>
  
          Content 1
        </et-inline-tab>
        <et-inline-tab>
          <ng-template et-inline-tab-label>
            Third
          </ng-template>
  
          Content 1
        </et-inline-tab> 
    </et-inline-tabs>
  `,
});

export const WithCustomLabel = TemplateCustomLabel.bind({});

WithCustomLabel.args = {
  ...Default.args,
};
