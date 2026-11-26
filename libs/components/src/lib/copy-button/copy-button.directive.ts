import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  output,
  signal,
} from '@angular/core';
import { copyToClipboard } from '@ethlete/core';
import { injectCopyButtonLabels } from './copy-button-labels';
import { Subject, catchError, of, switchMap, tap, timer } from 'rxjs';

const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  'white-space': 'nowrap',
  border: '0',
};

/**
 * Copies `text` to the clipboard on click and ticks `copied()` for `resetDelay` ms - the
 * icon-swap feedback every copy button in this library wants, without each one hand-rolling its
 * own reset timer. Carries no template or styling of its own; compose it with `et-icon-button` (or
 * any other button) and swap the icon off `copied()`:
 *
 * @example
 * <button [text]="jsonText" et-icon-button etCopyButton #copyBtn="etCopyButton" type="button" (copySucceed)="onCopy()">
 *   @if (copyBtn.copied()) {
 *     <i etIcon="et-check"></i>
 *   } @else {
 *     <i etIcon="et-clipboard-check"></i>
 *   }
 * </button>
 */
@Directive({
  selector: '[etCopyButton]',
  exportAs: 'etCopyButton',
  host: {
    '[attr.data-copied]': 'copied() || null',
    '[attr.data-copy-failed]': 'copyFailed() || null',
    '(click)': 'requestCopy()',
  },
})
export class CopyButtonDirective {
  private destroyRef = inject(DestroyRef);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = inject(Renderer2);
  private labels = injectCopyButtonLabels();

  /** The value to copy, or a getter for it - a getter avoids re-serializing on every change detection. */
  public text = input<string | (() => string)>('');

  /** How long `copied()` (or `copyFailed()`) stays `true` after a copy attempt. */
  public resetDelay = input(1200, { transform: numberAttribute });

  /** Fires once the value has actually reached the clipboard. */
  public copySucceed = output<void>();

  /** Fires when the value could not be copied - an insecure context, a denied permission, or no clipboard at all. */
  public copyFail = output<void>();
  private liveRegion = signal<HTMLElement | null>(null);
  private outcome = signal<'copied' | 'failed' | null>(null);

  /** Whether the last copy succeeded, for `resetDelay` ms. */
  public copied = computed(() => this.outcome() === 'copied');

  /** Whether the last copy failed, for `resetDelay` ms. */
  public copyFailed = computed(() => this.outcome() === 'failed');

  private reset$ = new Subject<void>();

  constructor() {
    afterNextRender(() => {
      const host = this.elementRef.nativeElement;
      const renderer = this.renderer;
      const region: HTMLElement = renderer.createElement('span');

      renderer.setAttribute(region, 'role', 'status');
      renderer.setAttribute(region, 'aria-live', 'polite');

      for (const [property, value] of Object.entries(VISUALLY_HIDDEN)) {
        renderer.setStyle(region, property, value);
      }

      renderer.insertBefore(renderer.parentNode(host), region, renderer.nextSibling(host));
      this.liveRegion.set(region);
      this.destroyRef.onDestroy(() => renderer.removeChild(renderer.parentNode(region), region));
    });

    effect(() => {
      const region = this.liveRegion();

      if (!region) return;

      const outcome = this.outcome();

      region.textContent =
        outcome === 'copied' ? this.labels().copied : outcome === 'failed' ? this.labels().copyFailed : '';
    });

    // Each copy restarts the countdown; switchMap drops the pending reset of the previous one.
    this.reset$
      .pipe(
        switchMap(() => timer(this.resetDelay())),
        tap(() => this.outcome.set(null)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  public requestCopy() {
    const text = this.text();

    copyToClipboard(typeof text === 'function' ? text() : text)
      .pipe(
        catchError(() => of(false)),
        tap((didCopy) => {
          this.outcome.set(didCopy ? 'copied' : 'failed');

          if (didCopy) this.copySucceed.emit();
          else this.copyFail.emit();

          this.reset$.next();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
