import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { signalHostElementDimensions, signalHostElementScrollState } from '@ethlete/core';
import { OffsetOptions } from '@floating-ui/dom';
import { CHEVRON_ICON } from '../../../icons/chevron-icon';
import { provideIcons } from '../../../icons/icon-provider';
import { IconDirective } from '../../../icons/icon.directive';
import { MenuImports } from '../../../overlay/components/menu/menu.imports';
import { SkeletonImports } from '../../../skeleton/skeleton.imports';
import { BreadcrumbItemTemplateDirective } from '../../directives/breadcrumb-item-template.directive';

const MIN_ITEMS_TO_RENDER = 3;

@Component({
  selector: 'et-breadcrumb',
  imports: [NgTemplateOutlet, MenuImports, IconDirective, SkeletonImports],
  providers: [provideIcons(CHEVRON_ICON)],
  template: `
    @if (itemsToRender(); as itemsToRender) {
      @for (itemTemplate of itemsToRender; track $index) {
        @if (itemTemplate.type === 'breadcrumb') {
          <ng-container *ngTemplateOutlet="itemsFromTemplateRefOrLoading; context: { item: itemTemplate.item }" />
        } @else {
          <button
            [etMenuTrigger]="menuTpl"
            [fallbackPlacements]="['bottom-end']"
            [offset]="offset()"
            class="et-breadcrumb-item"
            placement="bottom-start"
            aria-label="View hidden items"
          >
            ...
          </button>

          <ng-template #menuTpl>
            <et-menu class="et-breadcrumb-menu">
              @for (item of itemTemplate.items; track $index) {
                <et-menu-item>
                  <ng-container
                    *ngTemplateOutlet="itemsFromTemplateRefOrLoading; context: { item: itemTemplate.item }"
                  />
                </et-menu-item>
              }
            </et-menu>
          </ng-template>
        }
        @if (!$last) {
          <i class="et-breadcrumb-chevron" etIcon="et-chevron"> </i>
        }
      }
    }

    <ng-template #itemsFromTemplateRefOrLoading let-item="item">
      @if (item) {
        @if (item.loading()) {
          <et-skeleton class="et-breadcrumb-item">
            <et-skeleton-item class="w-16 h-4 rounded-medium" />
          </et-skeleton>
        } @else {
          <ng-container *ngTemplateOutlet="item.templateRef" />
        }
      }
    </ng-template>
  `,
  styleUrl: './breadcrumb.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-breadcrumb',
  },
})
export class BreadcrumbComponent {
  breadcrumbItemTemplates = contentChildren(BreadcrumbItemTemplateDirective);
  scrollState = signalHostElementScrollState();
  hostDimensions = signalHostElementDimensions();
  visibleElementCount = signal(MIN_ITEMS_TO_RENDER);
  offset = input<OffsetOptions | null>({ mainAxis: 0 });

  clientWidth = computed(() => this.hostDimensions().client?.width);

  itemsToRender = computed(() => {
    const itemTemplates = this.breadcrumbItemTemplates();

    if (!itemTemplates?.length) {
      return null;
    }

    const maxItems = this.visibleElementCount();

    if (itemTemplates.length === maxItems) {
      return itemTemplates.map((item) => ({
        type: 'breadcrumb',
        item: item,
      }));
    }

    const first = itemTemplates[0];
    const last = itemTemplates[itemTemplates.length - 1];
    const inBetween = itemTemplates.slice(1, itemTemplates.length - 1);

    return [
      {
        type: 'breadcrumb',
        item: first,
      },
      {
        type: 'menu',
        items: inBetween,
      },
      {
        type: 'breadcrumb',
        item: last,
      },
    ];
  });

  constructor() {
    effect(() => {
      const canScrollHorizontally = this.scrollState().canScrollHorizontally;

      if (!canScrollHorizontally || this.visibleElementCount() === MIN_ITEMS_TO_RENDER) {
        return;
      }

      this.visibleElementCount.update((v) => v - 1);
    });

    effect(() => {
      // We use the host element's clientWidth as a signal to tell the component to recompute how many item's can be visible.
      this.clientWidth();

      const itemCount = this.breadcrumbItemTemplates().length;

      this.visibleElementCount.set(itemCount);
    });
  }
}
