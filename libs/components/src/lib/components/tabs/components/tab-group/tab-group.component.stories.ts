import { A11yModule } from '@angular/cdk/a11y';
import { ObserversModule } from '@angular/cdk/observers';
import { PortalModule } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { TabComponent, TabLabelDirective } from '../../partials';
import { TabGroupComponent } from './tab-group.component';
import CustomMDXDocumentation from './tab-group.component.docs.mdx';

export default {
  title: 'Components/Tabs/Inline',
  component: TabGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        PortalModule,
        ObserversModule,
        A11yModule,
        BrowserAnimationsModule,
        TabComponent,
        TabLabelDirective,
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
} as Meta<TabGroupComponent>;

const Template: Story<TabGroupComponent> = (args) => ({
  props: args,
  template: `
    <et-tab-group [selectedIndex]="selectedIndex" [contentTabIndex]="contentTabIndex" [preserveContent]="preserveContent">
        <et-tab label="Tab One">Content 1</et-tab>
        <et-tab label="Other Tab">Content 2</et-tab>
        <et-tab label="One more Tab">Content 3</et-tab>
        <et-tab label="Tab">Content 4</et-tab>
        <et-tab label="Disabled Tab" disabled>Content 5</et-tab>
    </et-tab-group>
  `,
});

export const Default = Template.bind({});

Default.args = {
  selectedIndex: null,
  contentTabIndex: null,
  preserveContent: false,
  tabHeaderClasses: '',
};

const TemplateCustomLabel: Story<TabGroupComponent> = (args) => ({
  props: args,
  template: `
    <et-tab-group [selectedIndex]="selectedIndex" [contentTabIndex]="contentTabIndex" [preserveContent]="preserveContent">
        <et-tab>
          <ng-template et-tab-label>
            First
          </ng-template>
  
          Content 1
        </et-tab>
        <et-tab>
          <ng-template et-tab-label>
            Second
          </ng-template>
  
          Content 1
        </et-tab>
        <et-tab>
          <ng-template et-tab-label>
            Third
          </ng-template>
  
          Content 1
        </et-tab> 
    </et-tab-group>
  `,
});

export const WithCustomLabel = TemplateCustomLabel.bind({});

WithCustomLabel.args = {
  ...Default.args,
};
