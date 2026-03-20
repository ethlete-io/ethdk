import { ChangeDetectionStrategy, Component, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { injectQueryParam } from '@ethlete/core';
import {
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayMainDirective,
  OverlayTitleDirective,
} from '../../common';
import { createOverlayHandler, createOverlayHandlerWithQueryParamLifecycle } from '../../overlay-handler';
import { OverlayRef } from '../../overlay-ref';
import { dialogOverlayStrategy } from '../../strategies';
import { OVERLAY_PANEL_STYLES, STORY_HOST_STYLES } from './story-styles';

// ---------------------------------------------------------------------------
// createOverlayHandler demo
// ---------------------------------------------------------------------------

type HandlerDemoResult = 'confirmed' | 'dismissed';

@Component({
  selector: 'et-sb-overlay-handler-demo',
  template: `
    <div etOverlayHeader>
      <div class="hd-header-inner">
        <span class="hd-icon">H</span>
        <div class="hd-header-text">
          <h3 etOverlayTitle>Handler Demo</h3>
          <span class="hd-type-tag">createOverlayHandler</span>
        </div>
      </div>
    </div>
    <et-overlay-body>
      <p class="hd-info">
        This overlay was opened via <code>openHandlerDemoOverlay</code>. Choose a result below — it flows back to the
        <code>afterClosed</code> callback as a typed <code>'confirmed' | 'dismissed'</code> value.
      </p>
    </et-overlay-body>
    <div etOverlayFooter>
      <button (click)="dismiss()" class="hd-btn hd-btn--ghost" type="button">Dismiss</button>
      <button (click)="confirm()" class="hd-btn hd-btn--primary" type="button">Confirm</button>
    </div>
  `,
  styles: [
    OVERLAY_PANEL_STYLES,
    `
      et-sb-overlay-handler-demo {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 460px;
        max-width: 100%;
      }

      .hd-header-inner {
        align-items: center;
        display: flex;
        gap: 0.75rem;
      }

      .hd-icon {
        align-items: center;
        background: #3b82f6;
        border-radius: 8px;
        color: #fff;
        display: flex;
        flex-shrink: 0;
        font-size: 0.75rem;
        font-weight: 700;
        height: 32px;
        justify-content: center;
        letter-spacing: 0.05em;
        width: 32px;
      }

      .hd-header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .hd-type-tag {
        background: rgba(59, 130, 246, 0.15);
        border-radius: 4px;
        color: #93c5fd;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.6875rem;
        letter-spacing: 0.02em;
        padding: 1px 6px;
      }

      et-sb-overlay-handler-demo .et-overlay-header {
        border-bottom: 1px solid #27272a;
      }
      et-sb-overlay-handler-demo .et-overlay-footer {
        border-top: 1px solid #27272a;
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      et-sb-overlay-handler-demo h3 {
        font-size: 0.9375rem;
        font-weight: 600;
        margin: 0;
      }

      .hd-info {
        color: #a1a1aa;
        font-size: 0.8125rem;
        line-height: 1.6;
        margin: 0;
      }

      .hd-info code {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        color: #e4e4e7;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.8125em;
        padding: 1px 5px;
      }

      .hd-btn {
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8125rem;
        font-weight: 500;
        padding: 7px 16px;
        transition:
          background 0.15s,
          border-color 0.15s,
          color 0.15s;
      }

      .hd-btn--ghost {
        background: transparent;
        border: 1px solid #3f3f46;
        color: #a1a1aa;
      }
      .hd-btn--ghost:hover {
        background: #27272a;
        border-color: #52525b;
        color: #f4f4f5;
      }

      .hd-btn--primary {
        background: #3b82f6;
        border: 1px solid #3b82f6;
        color: #fff;
      }
      .hd-btn--primary:hover {
        background: #2563eb;
        border-color: #2563eb;
      }
    `,
  ],
  imports: [OverlayTitleDirective, OverlayHeaderDirective, OverlayBodyComponent, OverlayFooterDirective],
  hostDirectives: [OverlayMainDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayHandlerDemoComponent {
  private readonly _ref = inject<OverlayRef<OverlayHandlerDemoComponent, HandlerDemoResult>>(OverlayRef);

  confirm() {
    this._ref.close('confirmed');
  }
  dismiss() {
    this._ref.close('dismissed');
  }
}

// ---------------------------------------------------------------------------
// Exported handler — defined at module level, outside any component.
// In real apps this lives in the overlay component's own file and is imported
// wherever the overlay needs to be opened.
// ---------------------------------------------------------------------------
export const openHandlerDemoOverlay = createOverlayHandler<OverlayHandlerDemoComponent, void, HandlerDemoResult>({
  component: OverlayHandlerDemoComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '440px' }),
});

type ResultEntry = { value: string; type: 'confirmed' | 'dismissed' | 'null'; index: number };

@Component({
  selector: 'et-sb-overlay-handler-host',
  template: `
    <div class="et-sb-host">
      <div class="et-sb-section-header">
        <div>
          <h2 class="et-sb-heading">createOverlayHandler</h2>
          <p class="et-sb-subheading">
            Define the handler once at module level, then call it inside a component to get a typed
            <code>open()</code> function and lifecycle callbacks.
          </p>
        </div>
        <span class="et-sb-api-badge">overlay-handler.ts</span>
      </div>

      <div class="et-sb-card-grid">
        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Open overlay</h3>
          <p class="et-sb-card-text">
            Closing with <em>Confirm</em> or <em>Dismiss</em> returns a typed
            <code>'confirmed' | 'dismissed'</code> result via <code>afterClosed</code>.
          </p>
          <button (click)="open()" class="et-sb-btn" type="button">Open</button>
        </div>
      </div>

      <div class="et-sb-log-section">
        <div class="et-sb-log-header">
          <span class="et-sb-log-title">afterClosed result log</span>
          @if (resultLog().length > 0) {
            <button (click)="clearLog()" class="et-sb-log-clear" type="button">Clear</button>
          }
        </div>
        @if (resultLog().length === 0) {
          <p class="et-sb-log-empty">No results yet — open and close an overlay above.</p>
        } @else {
          <ul class="et-sb-log-list">
            @for (entry of resultLog(); track entry.index) {
              <li class="et-sb-log-entry">
                <span class="et-sb-log-index">#{{ entry.index }}</span>
                <span
                  [class.et-sb-log-badge--confirmed]="entry.type === 'confirmed'"
                  [class.et-sb-log-badge--dismissed]="entry.type === 'dismissed'"
                  [class.et-sb-log-badge--null]="entry.type === 'null'"
                  class="et-sb-log-badge"
                  >{{ entry.value }}</span
                >
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [
    STORY_HOST_STYLES,
    `
      .et-sb-log-section {
        margin-top: 1.75rem;
      }

      .et-sb-log-header {
        align-items: center;
        display: flex;
        gap: 0.75rem;
        margin-bottom: 0.625rem;
      }

      .et-sb-log-title {
        color: #e4e4e7;
        font-size: 0.8125rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .et-sb-log-clear {
        background: transparent;
        border: 1px solid #3f3f46;
        border-radius: 4px;
        color: #71717a;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.6875rem;
        padding: 2px 8px;
        transition:
          color 0.15s,
          border-color 0.15s;
      }
      .et-sb-log-clear:hover {
        border-color: #52525b;
        color: #a1a1aa;
      }

      .et-sb-log-empty {
        color: #52525b;
        font-size: 0.8125rem;
        font-style: italic;
        margin: 0;
      }

      .et-sb-log-list {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .et-sb-log-entry {
        align-items: center;
        display: flex;
        gap: 0.5rem;
      }

      .et-sb-log-index {
        color: #52525b;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.6875rem;
        min-width: 1.75rem;
        text-align: right;
      }

      .et-sb-log-badge {
        border-radius: 4px;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.75rem;
        padding: 2px 8px;
      }
      .et-sb-log-badge--confirmed {
        background: rgba(34, 197, 94, 0.15);
        color: #86efac;
      }
      .et-sb-log-badge--dismissed {
        background: rgba(161, 161, 170, 0.1);
        color: #a1a1aa;
      }
      .et-sb-log-badge--null {
        background: rgba(239, 68, 68, 0.1);
        color: #fca5a5;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayHandlerHostComponent {
  protected readonly resultLog = signal<ResultEntry[]>([]);
  private _counter = 0;

  // Class field initializer — runs in the injection context of the constructor.
  // In real apps this is exactly how you'd wire up the handler in any component.
  private readonly handler = openHandlerDemoOverlay({
    afterClosed: (result) => {
      const type: ResultEntry['type'] =
        result === 'confirmed' ? 'confirmed' : result === 'dismissed' ? 'dismissed' : 'null';
      this.resultLog.update((log) => [{ value: result ?? 'null', type, index: ++this._counter }, ...log].slice(0, 15));
    },
  });

  open() {
    this.handler.open();
  }

  clearLog() {
    this.resultLog.set([]);
    this._counter = 0;
  }
}

// ---------------------------------------------------------------------------
// createOverlayHandlerWithQueryParamLifecycle demo
// ---------------------------------------------------------------------------

@Component({
  selector: 'et-sb-overlay-query-param-demo',
  template: `
    <div etOverlayHeader>
      <div class="qp-header-inner">
        <span class="qp-icon">Q</span>
        <div class="qp-header-text">
          <h3 etOverlayTitle>Query Param Overlay</h3>
          <span class="qp-type-tag">createOverlayHandlerWithQueryParamLifecycle</span>
        </div>
      </div>
    </div>
    <et-overlay-body>
      <div class="qp-param-display">
        <div class="qp-param-row">
          <span class="qp-param-key">demo</span>
          <span class="qp-param-sep">=</span>
          <span class="qp-param-val">{{ overlayQueryParam() ?? '—' }}</span>
        </div>
        <span class="qp-param-url"
          >URL contains: <code>?demo={{ overlayQueryParam() }}</code></span
        >
      </div>
      <p class="qp-info">
        This overlay opens when the <code>demo</code> query param is present. Removing it (or calling
        <code>handler.close()</code>) closes this overlay automatically.
      </p>
    </et-overlay-body>
    <div etOverlayFooter>
      <button class="qp-close-btn" etOverlayClose type="button">Close overlay</button>
    </div>
  `,
  styles: [
    OVERLAY_PANEL_STYLES,
    `
      et-sb-overlay-query-param-demo {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 480px;
        max-width: 100%;
      }

      .qp-header-inner {
        align-items: center;
        display: flex;
        gap: 0.75rem;
      }

      .qp-icon {
        align-items: center;
        background: #8b5cf6;
        border-radius: 8px;
        color: #fff;
        display: flex;
        flex-shrink: 0;
        font-size: 0.75rem;
        font-weight: 700;
        height: 32px;
        justify-content: center;
        width: 32px;
      }

      .qp-header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .qp-type-tag {
        background: rgba(139, 92, 246, 0.15);
        border-radius: 4px;
        color: #c4b5fd;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.6875rem;
        letter-spacing: 0.02em;
        padding: 1px 6px;
      }

      et-sb-overlay-query-param-demo .et-overlay-header {
        border-bottom: 1px solid #27272a;
      }
      et-sb-overlay-query-param-demo .et-overlay-footer {
        border-top: 1px solid #27272a;
      }
      et-sb-overlay-query-param-demo h3 {
        font-size: 0.9375rem;
        font-weight: 600;
        margin: 0;
      }

      .qp-param-display {
        background: rgba(139, 92, 246, 0.08);
        border: 1px solid rgba(139, 92, 246, 0.2);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        margin-bottom: 1rem;
        padding: 0.75rem 1rem;
      }

      .qp-param-row {
        align-items: baseline;
        display: flex;
        gap: 0.25rem;
      }

      .qp-param-key {
        color: #c4b5fd;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 1rem;
        font-weight: 600;
      }

      .qp-param-sep {
        color: #71717a;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 1rem;
      }

      .qp-param-val {
        color: #f4f4f5;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 1rem;
        font-weight: 600;
      }

      .qp-param-url {
        color: #71717a;
        font-size: 0.75rem;
      }

      .qp-param-url code {
        background: rgba(255, 255, 255, 0.06);
        border-radius: 3px;
        color: #a1a1aa;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.875em;
        padding: 1px 4px;
      }

      .qp-info {
        color: #a1a1aa;
        font-size: 0.8125rem;
        line-height: 1.6;
        margin: 0;
      }

      .qp-info code {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        color: #e4e4e7;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.8125em;
        padding: 1px 5px;
      }

      .qp-close-btn {
        background: transparent;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        color: #a1a1aa;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8125rem;
        padding: 7px 16px;
        transition:
          background 0.15s,
          border-color 0.15s,
          color 0.15s;
      }
      .qp-close-btn:hover {
        background: #27272a;
        border-color: #52525b;
        color: #f4f4f5;
      }
    `,
  ],
  imports: [
    OverlayTitleDirective,
    OverlayCloseDirective,
    OverlayHeaderDirective,
    OverlayBodyComponent,
    OverlayFooterDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayQueryParamDemoComponent {
  // Named to match OVERLAY_QUERY_PARAM_INPUT_NAME so the handler can set it via setInput()
  readonly overlayQueryParam = input<string>();
}

// ---------------------------------------------------------------------------
// Exported handler — in real apps defined in the overlay component's file and
// initialized once in a long-lived component (e.g. AppComponent).
// ---------------------------------------------------------------------------
export const createQueryParamDemoOverlay = createOverlayHandlerWithQueryParamLifecycle<OverlayQueryParamDemoComponent>({
  component: OverlayQueryParamDemoComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '520px' }),
  queryParamKey: 'demo',
});

@Component({
  selector: 'et-sb-overlay-query-param-host',
  template: `
    <div class="et-sb-host">
      <div class="et-sb-section-header">
        <div>
          <h2 class="et-sb-heading">createOverlayHandlerWithQueryParamLifecycle</h2>
          <p class="et-sb-subheading">
            The overlay lifecycle is driven by a URL query param. The overlay opens when the param is present and closes
            (removing the param) when dismissed.
          </p>
        </div>
        <span class="et-sb-api-badge">overlay-handler.ts</span>
      </div>

      <div class="et-sb-url-bar">
        <span class="et-sb-url-label">URL query param state</span>
        <div [class.et-sb-url-state--active]="!!currentParam()" class="et-sb-url-state">
          <span class="et-sb-url-dot"></span>
          <code class="et-sb-url-value">
            @if (currentParam()) {
              ?demo={{ currentParam() }}
            } @else {
              no ?demo= param
            }
          </code>
          <span class="et-sb-url-status">{{ currentParam() ? 'overlay open' : 'overlay closed' }}</span>
        </div>
      </div>

      <div class="et-sb-card-grid">
        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Open (hello)</h3>
          <p class="et-sb-card-text">
            Sets <code>?demo=hello</code>. The handler opens the overlay and forwards the value as an input.
          </p>
          <button (click)="open('hello')" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Open (world)</h3>
          <p class="et-sb-card-text">
            Sets <code>?demo=world</code>. While open, the param stays in sync with the input signal.
          </p>
          <button (click)="open('world')" class="et-sb-btn" type="button">Open</button>
        </div>

        <div class="et-sb-card">
          <h3 class="et-sb-card-title">Close</h3>
          <p class="et-sb-card-text">
            Calls <code>handler.close()</code> — removes <code>?demo</code> and closes the overlay.
          </p>
          <button (click)="close()" class="et-sb-btn et-sb-btn--danger" type="button">Close</button>
        </div>
      </div>

      <div class="et-sb-custom-row">
        <label class="et-sb-custom-label" for="qp-custom">Custom value</label>
        <div class="et-sb-custom-group">
          <span class="et-sb-custom-prefix">?demo=</span>
          <input
            [value]="customValue()"
            (input)="customValue.set($any($event.target).value)"
            id="qp-custom"
            class="et-sb-custom-input"
            placeholder="enter a value…"
            type="text"
          />
          <button [disabled]="!customValue()" (click)="openCustom()" class="et-sb-btn" type="button">Open</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    STORY_HOST_STYLES,
    `
      .et-sb-url-bar {
        background: #1c1c1f;
        border: 1px solid #27272a;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        padding: 0.875rem 1rem;
      }

      .et-sb-url-label {
        color: #71717a;
        display: block;
        font-size: 0.6875rem;
        letter-spacing: 0.06em;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
      }

      .et-sb-url-state {
        align-items: center;
        display: flex;
        gap: 0.5rem;
      }

      .et-sb-url-dot {
        background: #52525b;
        border-radius: 50%;
        flex-shrink: 0;
        height: 7px;
        transition: background 0.2s;
        width: 7px;
      }
      .et-sb-url-state--active .et-sb-url-dot {
        background: #22c55e;
        box-shadow: 0 0 6px rgba(34, 197, 94, 0.45);
      }

      .et-sb-url-value {
        color: #a1a1aa;
        flex: 1;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.8125rem;
        transition: color 0.2s;
      }
      .et-sb-url-state--active .et-sb-url-value {
        color: #f4f4f5;
      }

      .et-sb-url-status {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 4px;
        color: #52525b;
        font-size: 0.6875rem;
        padding: 2px 7px;
        transition:
          background 0.2s,
          color 0.2s;
      }
      .et-sb-url-state--active .et-sb-url-status {
        background: rgba(34, 197, 94, 0.1);
        color: #86efac;
      }

      .et-sb-custom-row {
        margin-top: 1.5rem;
      }

      .et-sb-custom-label {
        color: #a1a1aa;
        display: block;
        font-size: 0.8125rem;
        margin-bottom: 0.5rem;
      }

      .et-sb-custom-group {
        align-items: stretch;
        display: flex;
      }

      .et-sb-custom-prefix {
        background: #27272a;
        border: 1px solid #3f3f46;
        border-radius: 6px 0 0 6px;
        border-right: none;
        color: #71717a;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.8125rem;
        padding: 7px 10px;
        white-space: nowrap;
      }

      .et-sb-custom-input {
        background: #18181b;
        border: 1px solid #3f3f46;
        border-left: none;
        border-right: none;
        color: #f4f4f5;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-size: 0.8125rem;
        outline: none;
        padding: 7px 12px;
        transition: border-color 0.15s;
        width: 180px;
      }
      .et-sb-custom-input:focus {
        border-color: #3b82f6;
        position: relative;
        z-index: 1;
      }
      .et-sb-custom-input::placeholder {
        color: #52525b;
      }

      .et-sb-custom-group .et-sb-btn {
        border-radius: 0 6px 6px 0;
        margin-top: 0;
      }
      .et-sb-custom-group .et-sb-btn:disabled {
        background: #27272a;
        color: #52525b;
        cursor: not-allowed;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayQueryParamHostComponent {
  // Class field initializer — in real apps this is typically in AppComponent so the
  // handler persists for the whole app lifetime and immediately reacts to any ?demo= param.
  private readonly handler = createQueryParamDemoOverlay();
  private readonly router = inject(Router);
  protected readonly currentParam = injectQueryParam('demo');
  protected readonly customValue = signal('');

  // Navigate via the Router directly — the handler watches the query param reactively
  // and opens/closes the overlay as a side-effect of the URL change.
  open(value: string) {
    this.router.navigate([], { queryParams: { demo: value }, queryParamsHandling: 'merge' });
  }

  close() {
    this.handler.close();
  }

  openCustom() {
    const v = this.customValue();
    if (v) this.router.navigate([], { queryParams: { demo: v }, queryParamsHandling: 'merge' });
  }
}
