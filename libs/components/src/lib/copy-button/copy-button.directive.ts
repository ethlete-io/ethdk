import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  afterNextRender,
  effect,
  inject,
  input,
  numberAttribute,
  output,
  signal,
} from '@angular/core';
import { copyToClipboard } from '@ethlete/core';
import { injectCopyButtonLabels } from './copy-button-labels';
import { Subject, switchMap, tap, timer } from 'rxjs';

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
 * <button [text]="jsonText" et-icon-button etCopyButton #copyBtn="etCopyButton" type="button" (copySuccess)="onCopy()">
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

  /** How long `copied()` stays `true` after a successful copy. */
  public resetDelay = input(1200, { transform: numberAttribute });

  /** Fires once the value has actually reached the clipboard. */
  public copySuccess = output<void>();
  private liveRegion = signal<HTMLElement | null>(null);

  public copied = signal(false);

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

      if (region) region.textContent = this.copied() ? this.labels().copied : '';
    });

    // Each copy restarts the countdown; switchMap drops the pending reset of the previous one.
    this.reset$
      .pipe(
        switchMap(() => timer(this.resetDelay())),
        tap(() => this.copied.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  public requestCopy() {
    const text = this.text();

    copyToClipboard(typeof text === 'function' ? text() : text)
      .pipe(
        tap((didCopy) => {
          if (!didCopy) return;

          this.copied.set(true);
          this.copySuccess.emit();
          this.reset$.next();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
