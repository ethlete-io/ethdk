import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewEncapsulation,
  contentChild,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { signalHostClasses, syncSignal } from '@ethlete/core';
import { OVERLAY_HEADER_TEMPLATE_TOKEN, OverlayBodyDividerType } from '../common';
import { OverlayRouterService } from '../routing';
import { SidebarOverlayService } from './sidebar-overlay';

@Component({
  selector: 'et-overlay-sidebar',
  template: `
    <ng-template #sidebarContentTpl>
      <ng-content />
    </ng-template>

    @if (sidebar.renderSidebar()) {
      <ng-container *ngTemplateOutlet="sidebarContent()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-sidebar-host',
  },
  imports: [NgTemplateOutlet],
})
export class OverlaySidebarComponent {
  sidebarContent = viewChild.required<TemplateRef<unknown>>('sidebarContentTpl');
  sidebarHeaderContent = contentChild(OVERLAY_HEADER_TEMPLATE_TOKEN);
  sidebar = inject(SidebarOverlayService);
  router = inject(OverlayRouterService);
  pageDividers = input<OverlayBodyDividerType>(false);

  hostClassBindings = signalHostClasses({
    'et-overlay-sidebar--visible': this.sidebar.renderSidebar,
  });

  constructor() {
    syncSignal(this.sidebarContent, this.sidebar.sidebarContentTemplate, { skipSyncRead: true });
    syncSignal(this.sidebarHeaderContent, this.sidebar.sidebarHeaderTemplate);
    syncSignal(this.pageDividers, this.sidebar.sidebarPageDividers);
  }
}
