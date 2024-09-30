import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { injectObserveBreakpoint } from '@ethlete/core';
import { MenuImports } from '../../../overlay/components/menu/menu.imports';
import { BreadcrumbItemTemplateDirective } from '../../directives/breadcrumb-item-template.directive';
import { BreadcrumbService } from '../../services/breadcrumb.service';

@Component({
  selector: 'et-breadcrumb',
  standalone: true,
  imports: [NgTemplateOutlet, MenuImports],
  template: `
    @if (itemsToRender(); as itemsToRender) {
      @for (itemTemplate of itemsToRender; track $index) {
        @if (itemTemplate.type === 'breadcrumb') {
          @if (itemTemplate.item) {
            <ng-container *ngTemplateOutlet="itemTemplate.item.templateRef" />
          }
        } @else {
          <button [etMenuTrigger]="menuTpl" class="et-breadcrumb-item">...</button>

          <ng-template #menuTpl>
            <et-menu>
              @for (item of itemTemplate.items; track $index) {
                <et-menu-item>
                  <ng-container *ngTemplateOutlet="item.templateRef" />
                </et-menu-item>
              }
            </et-menu>
          </ng-template>
        }
      }
    }
  `,
  styleUrl: './breadcrumb.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-breadcrumb',
  },
})
export class BreadcrumbComponent {
  readonly breadcrumbItemTemplates = contentChildren(BreadcrumbItemTemplateDirective);
  readonly breadcrumbService = inject(BreadcrumbService);

  isMinSm = injectObserveBreakpoint({ min: 'sm' });
  isMinMd = injectObserveBreakpoint({ min: 'md' });

  itemsToRender = computed(() => {
    const itemTemplates = this.breadcrumbItemTemplates();
    const isSmMin = this.isMinSm();

    if (!itemTemplates?.length) {
      return null;
    }

    if (isSmMin && itemTemplates.length < 3) {
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
}
