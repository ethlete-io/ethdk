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
import { mountTabScaleStyles } from '../tab-scale-styles.component';
import { mountTabUnderlineStyles } from '../tab-underline-styles.component';
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
    role: 'none',
    '[attr.data-orientation]': 'tabGroup.tabBar.orientation()',
    '[attr.data-size]': 'size()',
    '[attr.data-fit]': 'tabGroup.tabBar.fit()',
    '[attr.data-divider]': 'tabGroup.tabBar.divider()',
    '[attr.data-variant]': 'tabGroup.tabBar.variant()',
  },
  styles: `
    @layer components {
      @property --et-tab-group-gap {
        syntax: '<length>';
        inherits: false;
        initial-value: 0px;
      }

      @property --et-tab-group-header-gap {
        syntax: '<length>';
        inherits: true;
        initial-value: 0px;
      }

      @property --et-tab-group-trigger-padding-inline {
        syntax: '<length>';
        inherits: true;
        initial-value: 16px;
      }

      @property --et-tab-group-trigger-padding-block {
        syntax: '<length>';
        inherits: true;
        initial-value: 12px;
      }

      @property --et-tab-group-underline-size {
        syntax: '<length>';
        inherits: true;
        initial-value: 2px;
      }

      @property --et-tab-group-underline-radius {
        syntax: '<length>';
        inherits: true;
        initial-value: 1px;
      }

      .et-tab-group {
        display: flex;
        flex-direction: column;
        gap: var(--et-tab-group-gap);

        --et-tab-group-trigger-padding-inline: var(--et-tab-padding-inline);
        --et-tab-group-trigger-padding-block: var(--et-tab-padding-block);
        --et-tab-group-underline-size: var(--et-tab-underline-size);
        --et-tab-group-underline-radius: var(--et-tab-underline-radius);
        --et-tab-group-font-size: var(--et-tab-font-size);

        &[data-orientation='vertical'] {
          flex-direction: row;
        }

        &:where([data-variant='primary'][data-size='sm']) {
          --et-tab-group-underline-size: 3px;
        }

        &:where([data-variant='primary'][data-size='md']) {
          --et-tab-group-underline-size: 3px;
        }

        &:where([data-variant='primary'][data-size='lg']) {
          --et-tab-group-underline-size: 4px;
        }
      }

      .et-tab-group__header-shell {
        min-inline-size: 0;
      }

      .et-tab-group__header-scrollable {
        min-inline-size: 0;
      }

      .et-tab-group__header {
        position: relative;
        gap: var(--et-tab-group-header-gap);

        [data-orientation='vertical'] & {
          justify-items: start;
        }
      }

      .et-tab-group__trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding-inline: var(--et-tab-group-trigger-padding-inline);
        padding-block: var(--et-tab-group-trigger-padding-block);
        border: none;
        background: none;
        color: var(--et-surface-interaction-solid, inherit);
        font: inherit;
        font-size: var(--et-tab-group-font-size);
        cursor: pointer;
        position: relative;
        white-space: nowrap;
        user-select: none;
        transition:
          color 150ms ease,
          background 150ms ease;
        outline: none;
        border-radius: 0.5rem;

        .et-tab-group__trigger-content {
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 0.5rem;
          padding: 4px 8px;
          margin: -4px -8px;
        }

        .et-tab-group__trigger-icon {
          width: 1.2em;
          height: 1.2em;
        }

        [data-variant='primary'] & .et-tab-group__trigger-content {
          flex-direction: column;
          gap: 4px;
        }
      }

      .et-tab-group__body {
        display: grid;
      }

      .et-tab-group__panel {
        grid-area: 1 / 1;

        &[hidden] {
          display: none;
        }
      }
    }
  `,
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
    mountTabUnderlineStyles();

    // the component renders its panels inline instead of registering [etTabPanel] directives
    this.tabGroup.managesPanelsInternally.set(true);
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
