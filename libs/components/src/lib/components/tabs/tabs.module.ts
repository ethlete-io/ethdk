import { NgModule } from '@angular/core';
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

@NgModule({
  imports: [
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
  ],
  exports: [
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
  ],
})
export class TabsModule {}
