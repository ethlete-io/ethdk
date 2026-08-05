import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Directive, input, numberAttribute, output, signal } from '@angular/core';
import { copyToClipboard } from '@ethlete/core';
import { Subject, switchMap, tap, timer } from 'rxjs';

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
  /** The value to copy, or a getter for it - a getter avoids re-serializing on every change detection. */
  public text = input<string | (() => string)>('');

  /** How long `copied()` stays `true` after a successful copy. */
  public resetDelay = input(1200, { transform: numberAttribute });

  /** Fires once the value has actually reached the clipboard. */
  public copySuccess = output<void>();

  public copied = signal(false);

  private reset$ = new Subject<void>();

  constructor() {
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
      )
      .subscribe();
  }
}
