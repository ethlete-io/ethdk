import { InlineTabsComponent } from './components/inline-tabs';
import { NavTabsComponent } from './components/nav-tabs';
import { InlineTabComponent } from './partials/inline-tabs/inline-tab';
import { InlineTabBodyComponent } from './partials/inline-tabs/inline-tab-body';
import { InlineTabBodyHostDirective } from './partials/inline-tabs/inline-tab-body-host';
import { InlineTabContentDirective } from './partials/inline-tabs/inline-tab-content';
import { InlineTabHeaderComponent } from './partials/inline-tabs/inline-tab-header';
import { InlineTabLabelDirective } from './partials/inline-tabs/inline-tab-label';
import { InlineTabLabelWrapperDirective } from './partials/inline-tabs/inline-tab-label-wrapper';
import { NavTabLinkComponent } from './partials/nav-tabs/nav-tab-link';
import { NavTabsOutletComponent } from './partials/nav-tabs/nav-tabs-outlet';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TabImports = [
  InlineTabsComponent,
  InlineTabBodyComponent,
  InlineTabBodyHostDirective,
  InlineTabComponent,
  InlineTabContentDirective,
  InlineTabHeaderComponent,
  InlineTabLabelDirective,
  InlineTabLabelWrapperDirective,
  NavTabsOutletComponent,
  NavTabLinkComponent,
  NavTabsComponent,
] as const;
