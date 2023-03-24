import { Directive, inject, isDevMode, OnInit } from '@angular/core';
import { DestroyService, ResizeObserverService } from '@ethlete/core';
import { debounceTime, takeUntil } from 'rxjs';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';

@Directive({
  standalone: true,
  selector: 'et-textarea-input[etAutosize]',
  host: {
    class: 'et-textarea--autosize',
  },
  providers: [DestroyService],
})
export class AutosizeTextareaDirective implements OnInit {
  private readonly _input = inject<InputDirective<string | null>>(INPUT_TOKEN, { host: true });
  private readonly _resizeObserver = inject(ResizeObserverService);
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;

  get element() {
    if (!this._input.nativeInputRef?.element) {
      if (isDevMode()) {
        throw new Error('AutosizeTextareaDirective must be used with an input that has a native input element');
      }

      return null;
    }

    return this._input.nativeInputRef.element.nativeElement;
  }

  ngOnInit(): void {
    if (!this.element) {
      return;
    }

    this._resizeObserver
      .observe(this.element)
      .pipe(debounceTime(1), takeUntil(this._destroy$))
      .subscribe(() => this.updateSize());

    this.updateSize();
  }

  updateSize() {
    if (!this.element) {
      return;
    }

    this.element.style.height = '0';
    this.element.style.height = `${this.element.scrollHeight}px`;
  }
}
