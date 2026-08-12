import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, ViewEncapsulation, contentChild, input, viewChild } from '@angular/core';
import { syncSignal } from '@ethlete/core';
import { OverlayBodyDividerType } from '../overlay-body.component';
import { OVERLAY_HEADER_TEMPLATE_TOKEN } from '../overlay-header-template.directive';
import { injectSidebarOverlay } from './sidebar-overlay';

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
  styleUrl: './overlay-sidebar.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-overlay-sidebar-host',
    '[class.et-overlay-sidebar--visible]': 'sidebar.renderSidebar()',
  },
})
export class OverlaySidebarComponent {
  protected sidebar = injectSidebarOverlay();
  public pageDividers = input<OverlayBodyDividerType>(false);
  public sidebarContent = viewChild.required<TemplateRef<unknown>>('sidebarContentTpl');
  public sidebarHeaderContent = contentChild(OVERLAY_HEADER_TEMPLATE_TOKEN);

  constructor() {
    syncSignal(this.sidebarContent, this.sidebar.sidebarContentTemplate, { skipSyncRead: true });
    syncSignal(this.sidebarHeaderContent, this.sidebar.sidebarHeaderTemplate);
    syncSignal(this.pageDividers, this.sidebar.sidebarPageDividers);
  }
}
