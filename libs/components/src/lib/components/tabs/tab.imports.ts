import { InlineTabsComponent, NavTabsComponent } from './components';
import {
  ActiveTabUnderlineComponent,
  InlineTabBodyComponent,
  InlineTabBodyHostDirective,
  InlineTabComponent,
  InlineTabContentDirective,
  InlineTabHeaderComponent,
  InlineTabLabelDirective,
  InlineTabLabelWrapperDirective,
  NavTabLinkDirective,
  NavTabsOutletComponent,
} from './partials';

export const TabImports = [
  InlineTabsComponent,
  InlineTabBodyComponent,
  InlineTabBodyHostDirective,
  InlineTabComponent,
  InlineTabContentDirective,
  InlineTabHeaderComponent,
  ActiveTabUnderlineComponent,
  InlineTabLabelDirective,
  InlineTabLabelWrapperDirective,
  NavTabsOutletComponent,
  NavTabLinkDirective,
  NavTabsComponent,
] as const;
