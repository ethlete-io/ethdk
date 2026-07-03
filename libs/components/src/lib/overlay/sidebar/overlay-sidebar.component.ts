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
import { OverlayBodyDividerType } from '../overlay-body.component';
import { OVERLAY_HEADER_TEMPLATE_TOKEN } from '../overlay-header-template.directive';
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
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-overlay-sidebar-host',
  },
})
export class OverlaySidebarComponent {
  protected sidebar = inject(SidebarOverlayService);
  public pageDividers = input<OverlayBodyDividerType>(false);
  public sidebarContent = viewChild.required<TemplateRef<unknown>>('sidebarContentTpl');
  public sidebarHeaderContent = contentChild(OVERLAY_HEADER_TEMPLATE_TOKEN);

  public hostClassBindings = signalHostClasses({
    'et-overlay-sidebar--visible': this.sidebar.renderSidebar,
  });

  constructor() {
    syncSignal(this.sidebarContent, this.sidebar.sidebarContentTemplate, { skipSyncRead: true });
    syncSignal(this.sidebarHeaderContent, this.sidebar.sidebarHeaderTemplate);
    syncSignal(this.pageDividers, this.sidebar.sidebarPageDividers);
  }
}
