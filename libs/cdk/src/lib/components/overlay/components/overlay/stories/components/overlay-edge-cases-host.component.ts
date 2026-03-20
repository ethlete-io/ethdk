import { ChangeDetectionStrategy, Component, effect, signal, ViewEncapsulation } from '@angular/core';
import { injectOverlayManager } from '../../overlay-manager';
import { dialogOverlayStrategy } from '../../strategies';
import { OverlaySimpleContentComponent } from './overlay-shared-content.component';
import { STORY_HOST_STYLES } from './story-styles';

/**
 * Demonstrates that `overlayManager.open()` works correctly when called from inside an Angular
 * `effect()`. Previously this triggered two Angular errors:
 *
 *  - NG0602 – `toSignal()` cannot be called from within a reactive context
 *  - NG0600 – `effect()` cannot be called from within a reactive context
 *
 * Both errors originated inside `setupBreakpointEffects()` in the overlay manager, which called
 * `toSignal()` and `effect()` while the outer effect's reactive consumer was still active.
 * Wrapping those internal calls with `untracked()` resolves both issues.
 */
@Component({
  selector: 'et-sb-open-from-effect-host',
  template: `
    <div class="et-sb-host">
      <h2 class="et-sb-heading">Open from an effect()</h2>

      <div class="et-sb-notice">
        <p>
          Calling <code>overlayManager.open()</code> from inside an Angular <code>effect()</code> previously threw two
          errors due to the overlay manager's internal setup running while a reactive consumer was active:
        </p>
        <ul>
          <li>
            <code>NG0602</code> –
            <em>toSignal() cannot be called from within a reactive context</em>
          </li>
          <li>
            <code>NG0600</code> –
            <em>effect() cannot be called from within a reactive context</em>
          </li>
        </ul>
        <p>
          Both are fixed by wrapping the relevant calls inside <code>setupBreakpointEffects()</code> with
          <code>untracked()</code>.
        </p>
      </div>

      <div class="et-sb-btn-row">
        <button (click)="trigger()" class="et-sb-btn" type="button">Trigger open via signal&nbsp;→&nbsp;effect</button>
        @if (triggerCount() > 0) {
          <span class="et-sb-trigger-count">Triggered {{ triggerCount() }}×</span>
        }
      </div>
    </div>
  `,
  styles: [
    STORY_HOST_STYLES,
    `
      .et-sb-trigger-count {
        color: #a1a1aa;
        font-size: 0.8125rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class OpenFromEffectHostComponent {
  private readonly _manager = injectOverlayManager();

  /** Incrementing this signal causes the effect below to open a new overlay. */
  private readonly _openTrigger = signal(0);
  protected readonly triggerCount = this._openTrigger.asReadonly();

  constructor() {
    // This is the edge case: opening an overlay directly inside an effect().
    effect(() => {
      const count = this._openTrigger();
      if (count === 0) return;

      this._manager.open(OverlaySimpleContentComponent, {
        strategies: dialogOverlayStrategy(),
        data: {
          title: 'Opened from an effect()',
          description: `This overlay was triggered by signal change #${count} inside an effect().`,
        },
      });
    });
  }

  trigger() {
    this._openTrigger.update((n) => n + 1);
  }
}
