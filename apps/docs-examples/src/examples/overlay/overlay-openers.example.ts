import { Component, input, model, signal, ViewEncapsulation } from '@angular/core';
import { injectQueryParam } from '@ethlete/core';
import {
  BUTTON_IMPORTS,
  createOverlayOpener,
  defineOverlay,
  defineQueryParamOverlay,
  dialogOverlayStrategy,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  overlayResult,
  QueryParamOverlayLinkDirective,
} from '@ethlete/components';

@Component({
  selector: 'app-overlay-openers-query-param',
  template: `
    <div etOverlayHeader>
      <h2 etOverlayTitle>Query-param overlay</h2>
    </div>

    <et-overlay-body>
      <p>
        Driven by the <code>?demo=</code> query param. Current value: <strong>{{ overlayQueryParam() }}</strong>
      </p>
      <p>Removing the param, or closing below, tears the overlay down and clears the URL.</p>
    </et-overlay-body>

    <div etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
  hostDirectives: [OverlayMainDirective],
})
export class OverlayOpenersQueryParamComponent {
  public overlayQueryParam = model<string>();
}

const demoOverlay = defineQueryParamOverlay({
  component: OverlayOpenersQueryParamComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  queryParamKey: 'demo',
});

@Component({
  selector: 'app-overlay-openers-merge',
  template: `
    <div etOverlayHeader>
      <h2 etOverlayTitle>Config merging</h2>
    </div>

    <et-overlay-body>
      <p>
        Message input: <strong>{{ message() }}</strong>
      </p>
    </et-overlay-body>

    <div etOverlayFooter>
      <button (click)="overlayRef.close('closed via injectRef')" et-button size="sm" variant="outline">
        Close with result
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
  hostDirectives: [OverlayMainDirective],
})
export class OverlayOpenersMergeComponent {
  public message = input('Hello from the definition defaults');

  protected overlayRef = mergeOverlay.injectRef();
}

const mergeOverlay = defineOverlay({
  component: OverlayOpenersMergeComponent,
  result: overlayResult<string>(),
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
});

@Component({
  selector: 'app-overlay-openers-example',
  template: `
    <div>
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

    <p>Current <code>?demo</code> = {{ currentParam() ?? '-' }}</p>

    <div>
      <button (click)="openMerge($event)" et-button size="sm">Open with per-open input</button>
    </div>

    <p>Last result: {{ lastMergeResult() ?? '-' }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, QueryParamOverlayLinkDirective],
})
export class OverlayOpenersExampleComponent {
  protected currentParam = injectQueryParam('demo');
  protected readonly DEMO_OVERLAY = demoOverlay;

  protected demo = createOverlayOpener(demoOverlay);

  protected lastMergeResult = signal<string | null>(null);

  private mergeDemo = createOverlayOpener(mergeOverlay, {
    afterClosed: (result) => this.lastMergeResult.set(result ?? null),
  });

  protected openMerge(event: Event) {
    this.mergeDemo.open({
      origin: event,
      inputs: { message: () => 'Set via typed per-open inputs' },
    });
  }
}
