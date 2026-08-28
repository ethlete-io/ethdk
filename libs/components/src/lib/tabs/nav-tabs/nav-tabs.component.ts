import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { ScrollableButtonsDirective } from '../../scrollable/headless/scrollable-buttons.directive';
import { SCROLLABLE_IMPORTS } from '../../scrollable/scrollable.imports';
import { TabBarDirective } from '../headless/tab-bar.directive';
import { mountTabScaleStyles } from '../tab-scale-styles.component';
import { mountTabUnderlineStyles } from '../tab-underline-styles.component';
import { TAB_SIZES, TabSize } from '../tab-sizes';
import { NavTabsDirective } from './headless/nav-tabs.directive';

@Component({
  selector: 'et-nav-tabs',
  template: `
    <et-scrollable
      [direction]="tabBar.orientation()"
      [itemSize]="tabBar.fit() === 'fill' ? 'same' : 'auto'"
      class="et-nav-tabs__scrollable"
      etScrollableButtons
      renderMasks="false"
      role="presentation"
      scrollMode="element"
      scrollOrigin="center"
      scrollableClass="et-nav-tabs__container"
      scrollableRole="presentation"
    >
      <ng-content />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLABLE_IMPORTS, ScrollableButtonsDirective],
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
    NavTabsDirective,
  ],
  host: {
    class: 'et-nav-tabs et-tab-scale',
    '[attr.data-orientation]': 'tabBar.orientation()',
    '[attr.data-size]': 'size()',
    '[attr.data-fit]': 'tabBar.fit()',
    '[attr.data-divider]': 'tabBar.divider()',
    '[attr.data-variant]': 'tabBar.variant()',
  },
  styles: `
    @layer components {
      @property --et-nav-tabs-gap {
        syntax: '<length>';
        inherits: true;
        initial-value: 0px;
      }

      @property --et-nav-tabs-underline-size {
        syntax: '<length>';
        inherits: true;
        initial-value: 2px;
      }

      @property --et-nav-tabs-underline-radius {
        syntax: '<length>';
        inherits: true;
        initial-value: 1px;
      }

      .et-nav-tabs {
        display: block;
        min-inline-size: 0;

        --et-nav-tabs-underline-size: var(--et-tab-underline-size);
        --et-nav-tabs-underline-radius: var(--et-tab-underline-radius);
        --et-nav-tabs-font-size: var(--et-tab-font-size);

        &:where([data-variant='primary'][data-size='sm']) {
          --et-nav-tabs-underline-size: 3px;
        }

        &:where([data-variant='primary'][data-size='md']) {
          --et-nav-tabs-underline-size: 3px;
        }

        &:where([data-variant='primary'][data-size='lg']) {
          --et-nav-tabs-underline-size: 4px;
        }
      }

      .et-nav-tabs__scrollable {
        min-inline-size: 0;
      }

      .et-nav-tabs__container {
        position: relative;
        gap: var(--et-nav-tabs-gap);

        [data-orientation='vertical'] & {
          justify-items: start;
        }

        [data-orientation='vertical'][data-fit='fill'] & {
          justify-items: stretch;
        }
      }
    }
  `,
})
export class NavTabsComponent {
  protected tabBar = inject(TabBarDirective);

  public size = input<TabSize>(TAB_SIZES.MD);

  constructor() {
    mountTabScaleStyles();
    mountTabUnderlineStyles();
  }
}
