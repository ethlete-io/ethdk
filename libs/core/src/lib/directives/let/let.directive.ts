import { Directive, EmbeddedViewRef, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { LetContext } from './let.types';

@Directive({
  selector: '[etLet]',
  standalone: true,
})
export class LetDirective<T = unknown> {
  @Input()
  set etLet(value: T) {
    this._context.$implicit = this._context.etLet = value;
    this._updateView();
  }

  static ngTemplateGuard_ngLet: 'binding';

  private _context: LetContext<T> = new LetContext<T>();
  private _templateRef: TemplateRef<LetContext<T>> | null = null;
  private _viewRef: EmbeddedViewRef<LetContext<T>> | null = null;

  constructor(private _viewContainer: ViewContainerRef, templateRef: TemplateRef<LetContext<T>>) {
    this._templateRef = templateRef;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static ngTemplateContextGuard<T>(dir: LetDirective<T>, ctx: any): ctx is LetContext<T> {
    return true;
  }

  private _updateView() {
    if (!this._viewRef) {
      this._viewContainer.clear();
      if (this._templateRef) {
        this._viewRef = this._viewContainer.createEmbeddedView(this._templateRef, this._context);
      }
    }
  }
}
