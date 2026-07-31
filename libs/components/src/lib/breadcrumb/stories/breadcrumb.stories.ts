import { provideRouter, withHashLocation } from '@angular/router';
import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideBreadcrumbManager } from '../breadcrumb-manager';
import {
  BreadcrumbHomePageComponent,
  BreadcrumbRoutedStorybookComponent,
  BreadcrumbSquadPageComponent,
  BreadcrumbTeamPageComponent,
  BreadcrumbTeamsLayoutComponent,
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
        // The hierarchy the composed trail needs: a layout route per level, each contributing its own
        // crumb, with the leaf views adding only theirs.
        provideRouter(
          [
            // A root route of its own, so the shell's "Home" crumb has somewhere to go.
            { path: '', pathMatch: 'full', component: BreadcrumbHomePageComponent },
            {
              path: 'teams',
              component: BreadcrumbTeamsLayoutComponent,
              children: [
                { path: '', component: BreadcrumbTeamsPageComponent },
                {
                  path: 'chemie',
                  component: BreadcrumbTeamPageComponent,
                  children: [{ path: 'squad', component: BreadcrumbSquadPageComponent }],
                },
              ],
            },
            { path: '**', redirectTo: '' },
          ],
          withHashLocation(),
        ),
      ],
    }),
  ],
  args: { width: 640, collapse: true, loading: false, seo: false, separator: 'chevron', surface: 'dark' },
  argTypes: {
    width: { control: { type: 'range', min: 200, max: 900, step: 10 } },
    collapse: { control: 'boolean' },
    loading: { control: 'boolean' },
    seo: { control: 'boolean' },
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

export const StructuredData: Story = {
  args: { seo: true },
  parameters: {
    docs: {
      description: {
        story:
          '`etBreadcrumbSeo` emits a `schema.org` **BreadcrumbList** as JSON-LD, which is what earns a site ' +
          'the breadcrumb line in a search result instead of a bare URL. It reads the `name` and `url` each ' +
          'crumb states rather than the rendered DOM — a crumb is a template with no single text form, and ' +
          'a `routerLink` is a path where schema.org wants an absolute URL. The last crumb states no `url`: ' +
          'it is the page the markup is on. Collapse the trail with the `width` control and the emitted ' +
          'list stays whole — collapsing is a layout decision, not a change to the trail.',
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
          'The real shape of it: every view contributes only the crumb it owns via ' +
          '`<ng-template etBreadcrumbSegment>` — shell "Home", layout route "Teams", detail route the team name, ' +
          'leaf "Squad" — and the single `<et-breadcrumb-outlet>` in the shell composes them in view order. ' +
          'Navigating deeper appends a crumb instead of any view restating the path, and the team crumb fills ' +
          "itself in when the name loads — something a route-config-derived breadcrumb can't do.",
      },
    },
  },
};
