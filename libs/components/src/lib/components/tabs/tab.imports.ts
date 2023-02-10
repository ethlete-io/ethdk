import { InlineTabsComponent, NavTabsComponent } from './components';
import {
  InlineTabBodyComponent,
  InlineTabBodyHostDirective,
  InlineTabComponent,
  InlineTabContentDirective,
  InlineTabHeaderComponent,
  InlineTabLabelDirective,
  InlineTabLabelWrapperDirective,
  NavTabLinkComponent,
  NavTabsOutletComponent,
} from './partials';

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
