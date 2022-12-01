import { NgModule } from '@angular/core';
import { TabGroupComponent, TabNavPanelComponent } from './components';
import {
  TabBodyComponent,
  TabBodyPortalDirective,
  TabComponent,
  TabContentDirective,
  TabHeaderComponent,
  TabInkBarComponent,
  TabLabelDirective,
  TabLabelWrapperDirective,
  TabLinkDirective,
  TabNavBarComponent,
} from './partials';

@NgModule({
  imports: [
    TabGroupComponent,
    TabNavPanelComponent,
    TabBodyComponent,
    TabBodyPortalDirective,
    TabComponent,
    TabContentDirective,
    TabHeaderComponent,
    TabInkBarComponent,
    TabLabelDirective,
    TabLabelWrapperDirective,
    TabLinkDirective,
    TabNavBarComponent,
  ],
  exports: [
    TabGroupComponent,
    TabNavPanelComponent,
    TabBodyComponent,
    TabBodyPortalDirective,
    TabComponent,
    TabContentDirective,
    TabHeaderComponent,
    TabInkBarComponent,
    TabLabelDirective,
    TabLabelWrapperDirective,
    TabLinkDirective,
    TabNavBarComponent,
  ],
})
export class TabsModule {}
