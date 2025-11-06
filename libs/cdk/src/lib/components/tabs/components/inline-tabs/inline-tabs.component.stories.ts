import { provideAnimations } from '@angular/platform-browser/animations';
import { Meta, StoryFn, applicationConfig, moduleMetadata } from '@storybook/angular';
import { InlineTabComponent } from '../../partials/inline-tabs/inline-tab';
import { InlineTabLabelDirective } from '../../partials/inline-tabs/inline-tab-label';
import { InlineTabsComponent } from './inline-tabs.component';
import CustomMDXDocumentation from './inline-tabs.component.docs.mdx';

export default {
  title: 'CDK/Tabs/Inline',
  component: InlineTabsComponent,
  decorators: [
    moduleMetadata({
      imports: [InlineTabComponent, InlineTabLabelDirective],
    }),
    applicationConfig({
      providers: [provideAnimations()],
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
    direction: {
      control: {
        type: 'select',
      },
      options: ['horizontal', 'vertical'],
      name: 'Direction',
      description: 'Direction of the tabs',
    },
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<InlineTabsComponent>;

const Template: StoryFn<InlineTabsComponent> = (args) => ({
  props: args,
  template: `
    <et-inline-tabs [selectedIndex]="selectedIndex" [contentTabIndex]="contentTabIndex" [preserveContent]="preserveContent" [direction]="direction">
        <et-inline-tab label="Tab One">Content 1</et-inline-tab>
        <et-inline-tab label="Other Tab">Content 2</et-inline-tab>
        <et-inline-tab label="One more Tab">Content 3</et-inline-tab>
        <et-inline-tab label="Tab">Content 4</et-inline-tab>
        <et-inline-tab label="Disabled Tab" disabled>Content 5</et-inline-tab>
    </et-inline-tabs>
  `,
});

export const Default = {
  render: Template,

  args: {
    selectedIndex: null,
    contentTabIndex: null,
    preserveContent: false,
    tabHeaderClasses: '',
  },
};

const TemplateCustomLabel: StoryFn<InlineTabsComponent> = (args) => ({
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

export const WithCustomLabel = {
  render: TemplateCustomLabel,

  args: {
    ...Default.args,
  },
};
