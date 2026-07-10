import { Component, ViewEncapsulation, input, inputBinding, model, signal } from '@angular/core';
import { injectQueryParam } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { OverlayBodyComponent } from '../../overlay-body.component';
import { OverlayCloseDirective } from '../../overlay-close.directive';
import { defineOverlay, defineQueryParamOverlay } from '../../overlay-definition';
import { OverlayFooterDirective } from '../../overlay-footer.directive';
import { OverlayHeaderDirective } from '../../overlay-header.directive';
import { OverlayMainDirective } from '../../overlay-main.directive';
import { createOverlayOpener } from '../../overlay-opener';
import { OverlayTitleDirective } from '../../overlay-title.directive';
import { QueryParamOverlayLinkDirective } from '../../query-param-overlay-link.directive';
import { dialogOverlayStrategy } from '../../strategies';

@Component({
  selector: 'et-sb-qp-overlay',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h6 font-title" etOverlayTitle>Query-param overlay</h2>
    </div>

    <et-overlay-body>
      <p class="text-medium text-white/70">
        Driven by the <code class="rounded bg-white/10 px-1 py-0.5 text-small">?demo=</code> query param. Current value:
        <strong class="font-semibold text-white">{{ overlayQueryParam() }}</strong>
      </p>
      <p class="mt-3 text-small text-white/50">
        Removing the param — or closing below — tears the overlay down and clears the URL.
      </p>
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
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
      width: 100%;
      max-width: 460px;
    }
  `,
})
export class QueryParamOverlayComponent {
  // Named `overlayQueryParam` so the opener can two-way-sync it with the URL.
  public overlayQueryParam = model<string>();
}

// Defined once at module level — in a real app this lives in its own file next to the component.
const demoOverlay = defineQueryParamOverlay({
  component: QueryParamOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  panelClass: 'et-sb-qp-panel',
  queryParamKey: 'demo',
});

@Component({
  selector: 'et-sb-merge-overlay',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h6 font-title" etOverlayTitle>Config merging</h2>
    </div>

    <et-overlay-body>
      <p class="text-medium text-white/70">
        Message input: <strong class="font-semibold text-white">{{ message() }}</strong>
      </p>
      <p class="mt-3 text-small text-white/50">
        This pane carries both the definition-level and the opener-level panel class — configs merge additively instead
        of replacing each other.
      </p>
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button (click)="overlayRef.close('closed via injectRef')" et-button size="sm" variant="outline">
        Close with result
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayTitleDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  styles: `
    et-sb-merge-overlay {
      display: block;
      width: 100%;
      max-width: 460px;
    }
  `,
})
export class MergeDemoOverlayComponent {
  public message = input('Hello from the definition defaults');

  protected overlayRef = mergeDemoOverlay.injectRef();
}

const mergeDemoOverlay = defineOverlay<MergeDemoOverlayComponent, string>({
  component: MergeDemoOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  panelClass: 'et-sb-merge-panel-base',
});

@Component({
  selector: 'et-sb-overlay-opener',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Overlay openers</h2>
        <p class="text-small text-white/60">
          A URL query param drives the overlay lifecycle — open, deep-link, and browser back/forward all work.
        </p>
      </header>

      <div class="flex flex-wrap items-center gap-4">
        <button (click)="demo.open('hello')" et-button size="sm">Open (hello)</button>
        <button (click)="demo.open('world')" et-button size="sm" variant="tonal">Open (world)</button>
        <a
          [etQueryParamOverlayLink]="DEMO_OVERLAY"
          et-button
          etQueryParamOverlayLinkValue="from-link"
          size="sm"
          variant="outline"
        >
          Open via link
        </a>
        <button (click)="demo.close()" et-button size="sm" variant="transparent">Close</button>
      </div>

      <p class="text-small text-white/50">
        Current <code class="rounded bg-white/10 px-1 py-0.5">?demo</code> = {{ currentParam() ?? '—' }}
      </p>

      <header class="flex flex-col gap-1">
        <h2 class="text-h5 font-title">Config merging</h2>
        <p class="text-small text-white/60">
          Definition, opener and per-open configs merge additively — bindings, providers and classes concatenate.
        </p>
      </header>

      <div class="flex flex-wrap items-center gap-4">
        <button (click)="openMergeDemo($event)" et-button size="sm">Open with per-open binding</button>
      </div>

      <p class="text-small text-white/50">Last result: {{ lastMergeResult() ?? '—' }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, QueryParamOverlayLinkDirective],
  styles: `
    .et-sb-qp-panel,
    .et-sb-merge-panel-base {
      background-color: #1c1c1f;
      color: #fafafa;
    }
    .et-overlay--dialog.et-sb-qp-panel,
    .et-overlay--dialog.et-sb-merge-panel-base {
      border-radius: 12px;
    }
    .et-sb-merge-panel-opener {
      outline: 2px solid #6366f1;
      outline-offset: 2px;
    }
  `,
})
export class OverlayOpenerStorybookComponent {
  protected currentParam = injectQueryParam('demo');
  protected readonly DEMO_OVERLAY = demoOverlay;

  // Initialized once — reacts to any ?demo= param for the component's lifetime.
  protected demo = createOverlayOpener(demoOverlay);

  protected lastMergeResult = signal<string | null>(null);

  public mergeDemo = createOverlayOpener(mergeDemoOverlay, {
    panelClass: 'et-sb-merge-panel-opener',
    afterClosed: (result) => this.lastMergeResult.set(result),
  });

  protected openMergeDemo(event: Event) {
    this.mergeDemo.open({
      origin: event,
      bindings: [inputBinding('message', () => 'Set via a per-open input binding')],
    });
  }
}
