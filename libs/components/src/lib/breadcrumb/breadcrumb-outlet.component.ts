import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  contentChild,
  input,
  viewChild,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { BREADCRUMB_ERROR_CODES } from './breadcrumb-errors';
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
        <ng-content select="[etBreadcrumbSeparator]" />
      </et-breadcrumb>
    }

    @if (IS_DEV_MODE) {
      <div #unsupportedContent class="et-breadcrumb-outlet-unsupported" hidden><ng-content /></div>
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

  private unsupportedContent = viewChild<ElementRef<HTMLElement>>('unsupportedContent');

  protected readonly IS_DEV_MODE = ngDevMode;

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        const nodes = Array.from(this.unsupportedContent()?.nativeElement.childNodes ?? []);
        const hasContent = nodes.some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
        );

        if (!hasContent) return;

        console.warn(
          new RuntimeError(
            BREADCRUMB_ERROR_CODES.OUTLET_UNSUPPORTED_CONTENT,
            '[et-breadcrumb-outlet] only an <ng-template etBreadcrumbSeparator> is rendered from its content; ' +
              'everything else is dropped. Contribute crumbs from an <ng-template etBreadcrumbSegment> instead.',
          ).message,
        );
      });
    }
  }
}
