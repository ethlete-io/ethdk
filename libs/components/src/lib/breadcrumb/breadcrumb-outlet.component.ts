import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, booleanAttribute, contentChild, input } from '@angular/core';
import { injectBreadcrumbManager } from './breadcrumb-manager';
import { BreadcrumbLabels } from './breadcrumb-labels';
import { BreadcrumbComponent } from './breadcrumb.component';
import { BreadcrumbSeparatorDirective } from './headless';
import { BREADCRUMB_OUTLET_TOKEN } from './headless/breadcrumb-outlet.token';

/**
 * Renders the trail composed from every `<ng-template etBreadcrumbSegment>` currently on screen, in view
 * order. Put one in the app shell; the views below contribute their own crumbs and never restate their
 * ancestors'.
 *
 * Renders nothing while no view has contributed a crumb. A `<ng-template etBreadcrumbSeparator>`
 * projected into it sets the separator of the composed trail.
 *
 * @example
 * <et-breadcrumb-outlet />
 */
@Component({
  selector: 'et-breadcrumb-outlet',
  template: `
    <!-- Instantiating a segment is what brings its crumb templates (and their registrations) into
         existence. A segment declares templates only, so this renders nothing - the wrapper is hidden so
         that stray content in a segment stays invisible instead of leaking into the shell. -->
    <div class="et-breadcrumb-outlet-segments" hidden>
      @for (segment of manager.segments(); track segment) {
        <ng-container [ngTemplateOutlet]="segment.templateRef" />
      }
    </div>

    @if (manager.crumbs().length) {
      <et-breadcrumb [crumbs]="manager.crumbs()" [collapse]="collapse()" [labels]="labels()">
        <ng-content />
      </et-breadcrumb>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BreadcrumbComponent, NgTemplateOutlet],
  providers: [{ provide: BREADCRUMB_OUTLET_TOKEN, useExisting: BreadcrumbOutletComponent }],
  host: {
    class: 'et-breadcrumb-outlet',
  },
  styles: `
    @layer components {
      .et-breadcrumb-outlet {
        display: block;
      }
    }
  `,
})
export class BreadcrumbOutletComponent {
  protected manager = injectBreadcrumbManager();

  /** Forwarded to the composed breadcrumb: collapse the middle crumbs when the trail doesn't fit. @default true */
  public collapse = input(true, { transform: booleanAttribute });

  /** Forwarded to the composed breadcrumb: per-instance overrides for its accessible labels. */
  public labels = input<Partial<BreadcrumbLabels> | null>(null);

  /** @internal */
  public separatorTemplate = contentChild(BreadcrumbSeparatorDirective, { descendants: true });
}
