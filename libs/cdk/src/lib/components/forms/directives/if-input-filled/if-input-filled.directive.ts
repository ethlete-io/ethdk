import { Directive, inject, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { distinctUntilChanged, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN } from '../input';

@Directive({
  selector: '[etIfInputFilled]',
  standalone: true,
})
export class IfInputFilledDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  private readonly _input = inject(INPUT_TOKEN);
  private readonly _templateRef = inject(TemplateRef);
  private readonly _viewContainerRef = inject(ViewContainerRef);

  private _didCreateView = false;

  ngOnInit() {
    this._input.value$
      .pipe(
        takeUntil(this._destroy$),
        distinctUntilChanged(),
        tap((value) => {
          if (value) {
            if (!this._didCreateView) {
              this._viewContainerRef.createEmbeddedView(this._templateRef);
              this._didCreateView = true;
            }
          } else {
            this._viewContainerRef.clear();
            this._didCreateView = false;
          }
        }),
      )
      .subscribe();
  }
}
