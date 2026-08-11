import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, ViewEncapsulation, inject, input } from '@angular/core';
import { BUTTON_IMPORTS } from '../button';
import { ELLIPSIS_ICON, IconDirective, provideIcons } from '../icon';
import { TOGGLETIP_IMPORTS } from '../toggletip';
import { BreadcrumbCrumb } from './breadcrumb.types';
import { BreadcrumbDirective } from './headless';

/**
 * The control the collapsed middle crumbs live behind. Rendered by the breadcrumb in the overflow slot -
 * you never place it yourself; apply `etBreadcrumbCollapse` and the breadcrumb takes it from there.
 *
 * A toggletip, not a menu: the hidden crumbs are links and headings of the consumer's making, and a
 * `role="menu"` may only contain menu items. This keeps them a plain list of links, reachable with Tab
 * and dismissed with Escape.
 */
@Component({
  selector: 'et-breadcrumb-overflow',
  template: `
    <button
      [etToggletip]="overflow"
      [etToggletipAriaLabel]="breadcrumb.resolvedLabels().overflow"
      [attr.aria-label]="breadcrumb.resolvedLabels().overflow"
      class="et-breadcrumb-overflow-trigger"
      et-icon-button
      etToggletipTrigger
      color="surface"
      size="xs"
      type="button"
      variant="transparent"
    >
      <i etIcon="et-ellipsis"></i>
    </button>

    <ng-template #overflow>
      <ol class="et-breadcrumb-overflow-list" data-toggletip-hug>
        @for (item of items(); track $index) {
          <li>
            <ng-container [ngTemplateOutlet]="crumbTemplate()" [ngTemplateOutletContext]="{ $implicit: item }" />
          </li>
        }
      </ol>
    </ng-template>
  `,
  styleUrl: './breadcrumb-overflow.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, IconDirective, NgTemplateOutlet, TOGGLETIP_IMPORTS],
  providers: [provideIcons(ELLIPSIS_ICON)],
  host: {
    class: 'et-breadcrumb-overflow',
  },
})
export class BreadcrumbOverflowComponent {
  protected breadcrumb = inject(BreadcrumbDirective);

  /** The crumbs that didn't fit, in trail order. */
  public items = input.required<readonly BreadcrumbCrumb[]>();

  /** The breadcrumb's crumb template, so an overflowed crumb renders exactly like an inline one. */
  public crumbTemplate = input.required<TemplateRef<{ $implicit: BreadcrumbCrumb }>>();
}
