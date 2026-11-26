import { Directive, ElementRef, afterEveryRender, booleanAttribute, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, tap } from 'rxjs';
import { rememberView, rememberedView } from '../studio-view/remembered';

export const canRestoreScroll = (
  target: number,
  { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number },
) => target > 0 && scrollHeight - clientHeight >= target;

/** Keeps the scroll position of the element across reloads and restores it after the first render whose content is complete and tall enough. */
@Directive({
  selector: '[ethleteRememberedTreeScroll]',
  host: { '(scroll)': 'scrolled$.next()' },
})
export class RememberedTreeScrollDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public complete = input.required({ alias: 'ethleteRememberedTreeScroll', transform: booleanAttribute });

  protected scrolled$ = new Subject<void>();

  private target = rememberedView().treeScroll ?? 0;

  constructor() {
    this.scrolled$
      .pipe(
        debounceTime(150),
        tap(() => {
          if (this.target === 0) rememberView({ treeScroll: this.elementRef.nativeElement.scrollTop });
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    const restore = afterEveryRender(() => {
      if (!this.complete() || !canRestoreScroll(this.target, this.elementRef.nativeElement)) return;

      this.elementRef.nativeElement.scrollTop = this.target;
      this.target = 0;
      restore.destroy();
    });
  }
}
