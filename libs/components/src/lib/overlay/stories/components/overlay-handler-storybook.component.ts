import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, model } from '@angular/core';
import { Router } from '@angular/router';
import { injectQueryParam } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { OverlayBodyComponent } from '../../overlay-body.component';
import { OverlayCloseDirective } from '../../overlay-close.directive';
import { OverlayFooterDirective } from '../../overlay-footer.directive';
import { OverlayHandlerLinkDirective } from '../../overlay-handler-link.directive';
import { createOverlayHandlerWithQueryParamLifecycle } from '../../overlay-handler';
import { OverlayHeaderDirective } from '../../overlay-header.directive';
import { OverlayMainDirective } from '../../overlay-main.directive';
import { OverlayTitleDirective } from '../../overlay-title.directive';
import { dialogOverlayStrategy } from '../../strategies';

@Component({
  selector: 'et-sb-qp-overlay',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 class="text-h6 font-title" etOverlayTitle>Query-param overlay</h2>
      </div>

      <et-overlay-body>
        <p class="text-medium text-white/70">
          Driven by the <code class="rounded bg-white/10 px-1 py-0.5 text-small">?demo=</code> query param. Current
          value: <strong class="font-semibold text-white">{{ overlayQueryParam() }}</strong>
        </p>
        <p class="mt-3 text-small text-white/50">
          Removing the param — or closing below — tears the overlay down and clears the URL.
        </p>
      </et-overlay-body>

      <div class="flex justify-end" etOverlayFooter>
        <button et-button etOverlayClose size="sm" variant="outline">Close</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
    OverlayCloseDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  styles: `
    et-sb-qp-overlay {
      display: block;
      width: 460px;
      max-width: 100vw;
    }
  `,
})
export class QueryParamOverlayComponent {
  // Named `overlayQueryParam` so the handler can two-way-sync it with the URL.
  public overlayQueryParam = model<string>();
}

// Defined once at module level — in a real app this lives in a long-lived component (e.g. AppComponent).
const openQueryParamOverlay = createOverlayHandlerWithQueryParamLifecycle<QueryParamOverlayComponent>({
  component: QueryParamOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  panelClass: 'et-sb-qp-panel',
  queryParamKey: 'demo',
});

@Component({
  selector: 'et-sb-overlay-handler',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Overlay Handlers</h2>
        <p class="text-small text-white/60">
          A URL query param drives the overlay lifecycle — open, deep-link, and browser back/forward all work.
        </p>
      </header>

      <div class="flex flex-wrap items-center gap-4">
        <button (click)="open('hello')" et-button size="sm">Open (hello)</button>
        <button (click)="open('world')" et-button size="sm" variant="tonal">Open (world)</button>
        <a etOverlayHandlerLink="from-link" etOverlayHandlerQueryParamName="demo" et-button size="sm" variant="outline">
          Open via link
        </a>
        <button (click)="handler.close()" et-button size="sm" variant="transparent">Close</button>
      </div>

      <p class="text-small text-white/50">
        Current <code class="rounded bg-white/10 px-1 py-0.5">?demo</code> = {{ currentParam() ?? '—' }}
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BUTTON_IMPORTS, OverlayHandlerLinkDirective],
  styles: `
    .et-sb-qp-panel {
      background-color: #1c1c1f;
      color: #fafafa;
    }
    .et-overlay--dialog.et-sb-qp-panel {
      border-radius: 12px;
    }
  `,
})
export class OverlayHandlerStorybookComponent {
  private router = inject(Router);

  // Initialized once — reacts to any ?demo= param for the component's lifetime.
  protected handler = openQueryParamOverlay();
  protected currentParam = injectQueryParam('demo');

  protected open(value: string) {
    this.router.navigate([], { queryParams: { demo: value }, queryParamsHandling: 'merge' });
  }
}
