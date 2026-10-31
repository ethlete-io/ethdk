import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, contentChildren, inject, input } from '@angular/core';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { FocusRingDirective } from '../../focus-ring';
import { IconDirective } from '../../icon';
import { ScrollableButtonsDirective } from '../../scrollable/headless/scrollable-buttons.directive';
import { SCROLLABLE_IMPORTS } from '../../scrollable/scrollable.imports';
import { TabBarTriggerDirective } from '../headless/tab-bar-trigger.directive';
import { TabBarUnderlineDirective } from '../headless/tab-bar-underline.directive';
import { TabBarDirective } from '../headless/tab-bar.directive';
import { mountTabBarStyles } from '../tab-bar-styles.component';
import { mountTabScaleStyles } from '../tab-scale-styles.component';
import { TAB_SIZES, TabSize } from '../tab-sizes';
import { TabGroupDirective } from './headless/tab-group.directive';
import { TabComponent } from './tab.component';

@Component({
  selector: 'et-tab-group',
  template: `
    <div [attr.aria-orientation]="tabGroup.tabBar.orientation()" class="et-tab-group__header-shell" role="tablist">
      <et-scrollable
        [direction]="tabGroup.tabBar.orientation()"
        [itemSize]="tabGroup.tabBar.fit() === 'fill' ? 'same' : 'auto'"
        class="et-tab-group__header-scrollable"
        etScrollableButtons
        renderMasks="false"
        role="presentation"
        scrollMode="element"
        scrollOrigin="center"
        scrollableClass="et-tab-group__header"
        scrollableRole="presentation"
      >
        @for (tab of tabs(); track tab; let idx = $index) {
          <button
            [class.et-tab-group__trigger--active]="tabGroup.tabBar.selectedIndex() === idx"
            [class.et-tab-group__trigger--disabled]="tab.disabled()"
            [disabled]="tab.disabled()"
            [attr.aria-controls]="'et-tab-panel-' + tabGroupId + '-' + idx"
            [attr.aria-label]="tab.ariaLabel()"
            class="et-tab-group__trigger"
            etTabBarTrigger
            etFocusRing
          >
            <span class="et-tab-group__trigger-content">
              @if (tab.icon(); as icon) {
                <span [etIcon]="icon" class="et-tab-group__trigger-icon"></span>
              }
              @if (tab.customLabel(); as customLabel) {
                <ng-container [ngTemplateOutlet]="customLabel.templateRef" />
              } @else {
                <ng-container [ngTemplateOutlet]="tab.implicitLabelRef()" />
              }
            </span>
            <span etTabBarUnderline></span>
          </button>
        }
      </et-scrollable>
    </div>
    <div class="et-tab-group__body">
      @for (tab of tabs(); track tab; let idx = $index) {
        <div
          [attr.id]="'et-tab-panel-' + tabGroupId + '-' + idx"
          [attr.aria-labelledby]="triggerElements()[idx]?.ID ?? null"
          [attr.inert]="tabGroup.tabBar.selectedIndex() !== idx || null"
          [attr.hidden]="isPanelHidden(idx) || null"
          class="et-tab-group__panel"
          role="tabpanel"
        >
          @if (shouldRenderPanel(idx)) {
            <ng-container [ngTemplateOutlet]="tab.contentRef()" />
          }
        </div>
      }
    </div>
  `,
  styleUrl: './tab-group.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    TabBarTriggerDirective,
    TabBarUnderlineDirective,
    NgTemplateOutlet,
    IconDirective,
    FocusRingDirective,
    SCROLLABLE_IMPORTS,
    ScrollableButtonsDirective,
  ],
  hostDirectives: [
    {
      directive: ProvideSurfaceDirective,
      inputs: ['etProvideSurface:surface'],
    },
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
    {
      directive: TabBarDirective,
      inputs: ['orientation', 'fit', 'divider', 'variant'],
    },
    {
      directive: TabGroupDirective,
      inputs: ['preserveContent', 'selectedIndex', 'sessionMemoryKey'],
      outputs: ['selectedIndexChange'],
    },
  ],
  host: {
    class: 'et-tab-group et-tab-scale',
    '[attr.data-orientation]': 'tabGroup.tabBar.orientation()',
    '[attr.data-size]': 'size()',
    '[attr.data-fit]': 'tabGroup.tabBar.fit()',
    '[attr.data-divider]': 'tabGroup.tabBar.divider()',
    '[attr.data-variant]': 'tabGroup.tabBar.variant()',
  },
})
export class TabGroupComponent {
  protected tabGroup = inject(TabGroupDirective);

  public size = input<TabSize>(TAB_SIZES.MD);
  public tabs = contentChildren(TabComponent);
  protected triggerElements = computed(() => this.tabGroup.tabBar.triggers());

  /** @internal */
  public tabGroupId = this.tabGroup.tabBar.ID;

  constructor() {
    mountTabScaleStyles();
    mountTabBarStyles();

    this.tabGroup.managesPanelsInternally.set(true);
    this.tabGroup.tabBar.hostRole.set('none');
  }

  protected isPanelHidden(index: number) {
    if (this.tabGroup.preserveContent()) {
      return this.tabGroup.tabBar.selectedIndex() !== index;
    }

    return false;
  }

  protected shouldRenderPanel(index: number) {
    if (this.tabGroup.preserveContent()) {
      return true;
    }

    return this.tabGroup.tabBar.selectedIndex() === index;
  }
}
