import { Directive, inject, input, numberAttribute } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ResizeObserverService } from '@ethlete/core';
import { combineLatest, of, switchMap, tap } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

@Directive({
  standalone: true,
  selector: 'et-textarea-input[etAutosize]',
  host: {
    class: 'et-textarea--autosize',
  },
})
export class AutosizeTextareaDirective {
  private input = inject<InputDirective<string | null>>(INPUT_TOKEN, { host: true });
  private resizeObserver = inject(ResizeObserverService);

  maxHeight = input(null, { transform: numberAttribute, alias: 'etAutosizeMaxHeight' });

  constructor() {
    combineLatest([this.input.nativeInputElement$, toObservable(this.maxHeight)])
      .pipe(
        switchMap(([el, maxHeight]) =>
          el
            ? combineLatest([this.resizeObserver.observe(el), this.input.value$]).pipe(
                tap(() => {
                  this.updateSize(el, maxHeight);
                }),
              )
            : of(null),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  updateSize(el: HTMLElement, maxHeight: number | null) {
    el.style.height = '0';

    const newHeight = maxHeight ? Math.min(el.scrollHeight, maxHeight) : el.scrollHeight;

    el.style.height = `${newHeight}px`;
  }
}
