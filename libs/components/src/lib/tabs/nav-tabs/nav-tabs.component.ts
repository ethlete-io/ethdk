import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, input } from '@angular/core';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { SCROLLABLE_IMPORTS } from '../../scrollable/scrollable.imports';
import { TabBarDirective } from '../headless/tab-bar.directive';
import { TAB_SIZES, TabSize } from '../tab-sizes';
import { NavTabsDirective } from './headless/nav-tabs.directive';

@Component({
  selector: 'et-nav-tabs',
  template: `
    <et-scrollable
      [direction]="tabBar.orientation()"
      [itemSize]="tabBar.fit() === 'fill' ? 'same' : 'auto'"
      [renderMasks]="false"
      class="et-nav-tabs__scrollable"
      buttonPosition="inside"
      scrollMode="element"
      scrollOrigin="center"
      scrollableClass="et-nav-tabs__container"
    >
      <ng-content />
    </et-scrollable>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SCROLLABLE_IMPORTS],
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
    class: 'et-nav-tabs',
    '[attr.data-orientation]': 'tabBar.orientation()',
    '[attr.data-size]': 'size()',
    '[attr.data-fit]': 'tabBar.fit()',
    '[attr.data-divider]': 'tabBar.divider()',
    '[attr.data-variant]': 'tabBar.variant()',
  },
  styles: `
    @property --et-nav-tabs-gap {
      syntax: '<length>';
      inherits: false;
      initial-value: 0px;
    }

    @property --et-nav-tabs-underline-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 2px;
    }

    @property --et-nav-tabs-underline-radius {
      syntax: '<length>';
      inherits: false;
      initial-value: 1px;
    }

    @property --et-nav-tabs-font-size {
      syntax: '<length>';
      inherits: false;
      initial-value: 1.4rem;
    }

    .et-nav-tabs {
      display: block;
      min-inline-size: 0;
    }

    .et-nav-tabs__scrollable {
      min-inline-size: 0;
    }

    .et-nav-tabs__container {
      position: relative;
      gap: var(--et-nav-tabs-gap);

      &::after {
        content: '';
        position: absolute;
        background: var(--et-surface-border-solid, currentColor);
        opacity: 0.2;
        pointer-events: none;
      }

      [data-divider='false'] &::after {
        display: none;
      }

      [data-orientation='horizontal'] &::after {
        bottom: 0;
        left: 0;
        right: 0;
        height: var(--et-nav-tabs-underline-size);
        border-radius: var(--et-nav-tabs-underline-radius);
      }

      [data-orientation='vertical'] & {
        justify-items: start;
      }

      [data-orientation='vertical'] &::after {
        left: 0;
        top: 0;
        bottom: 0;
        width: var(--et-nav-tabs-underline-size);
        border-radius: var(--et-nav-tabs-underline-radius);
      }

      [data-size='sm'] & {
        --et-nav-tabs-underline-size: 2px;
        --et-nav-tabs-font-size: 1.2rem;
      }

      [data-size='md'] & {
        --et-nav-tabs-underline-size: 2px;
        --et-nav-tabs-font-size: 1.4rem;
      }

      [data-size='lg'] & {
        --et-nav-tabs-underline-size: 3px;
        --et-nav-tabs-font-size: 1.6rem;
      }

      [data-variant='primary'][data-size='sm'] & {
        --et-nav-tabs-underline-size: 3px;
      }

      [data-variant='primary'][data-size='md'] & {
        --et-nav-tabs-underline-size: 3px;
      }

      [data-variant='primary'][data-size='lg'] & {
        --et-nav-tabs-underline-size: 4px;
      }
    }
  `,
})
export class NavTabsComponent {
  protected tabBar = inject(TabBarDirective);

  public size = input<TabSize>(TAB_SIZES.MD);
}
