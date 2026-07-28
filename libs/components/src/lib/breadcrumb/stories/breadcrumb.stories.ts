import { provideRouter, withHashLocation } from '@angular/router';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideBreadcrumbManager } from '../breadcrumb-manager';
import {
  BreadcrumbRoutedStorybookComponent,
  BreadcrumbSquadPageComponent,
  BreadcrumbTeamPageComponent,
  BreadcrumbTeamsPageComponent,
} from './breadcrumb-routed-storybook.component';
import { BreadcrumbStorybookComponent } from './breadcrumb-storybook.component';

export default {
  title: 'Components/Breadcrumb',
  component: BreadcrumbStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [BreadcrumbStorybookComponent, BreadcrumbRoutedStorybookComponent] }),
    applicationConfig({
      providers: [
        provideBreadcrumbManager(),
        provideRouter(
          [
            { path: 'teams', component: BreadcrumbTeamsPageComponent },
            { path: 'teams/chemie', component: BreadcrumbTeamPageComponent },
            { path: 'teams/chemie/squad', component: BreadcrumbSquadPageComponent },
            { path: '**', redirectTo: 'teams' },
          ],
          withHashLocation(),
        ),
      ],
    }),
  ],
  args: { width: 640, collapse: true, loading: false, separator: 'chevron', surface: 'dark' },
  argTypes: {
    width: { control: { type: 'range', min: 200, max: 900, step: 10 } },
    collapse: { control: 'boolean' },
    loading: { control: 'boolean' },
    separator: { control: 'radio', options: ['chevron', 'slash'] },
    surface: { control: 'text' },
  },
} as Meta<BreadcrumbStorybookComponent>;

type Story = StoryObj<BreadcrumbStorybookComponent>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: { width: 340 },
  parameters: {
    docs: {
      description: {
        story:
          'Too narrow for the full trail: the middle crumbs move into a toggletip behind the ellipsis, ' +
          'while the first crumb and the current page stay visible. Widen it and they come back — the ' +
          'width the full trail needs is measured once, so it never flickers between the two states.',
      },
    },
  },
};

export const Loading: Story = {
  args: { loading: true },
  parameters: {
    docs: {
      description: {
        story:
          'A crumb whose label is still being fetched renders a placeholder in its slot, so the trail ' +
          "doesn't shift sideways when the name arrives.",
      },
    },
  },
};

export const CustomSeparator: Story = {
  args: { separator: 'slash' },
  parameters: {
    docs: {
      description: {
        story: '`<ng-template etBreadcrumbSeparator>` replaces the chevron between crumbs with anything you like.',
      },
    },
  },
};

export const RoutedOutlet: Story = {
  render: (args) => ({ props: args, template: '<et-sb-breadcrumb-routed [surface]="surface" />' }),
  parameters: {
    docs: {
      description: {
        story:
          'The real shape of it: each routed page declares its trail in an `<ng-template etBreadcrumbTemplate>`, ' +
          'and the shell renders whatever is registered through a single `<et-breadcrumb-outlet>`. The team page ' +
          "fills its last crumb in when the name loads — something a route-config-derived breadcrumb can't do.",
      },
    },
  },
};
