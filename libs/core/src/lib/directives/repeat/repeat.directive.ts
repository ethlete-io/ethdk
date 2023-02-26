import { coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[etRepeat]',
  standalone: true,
})
export class RepeatDirective {
  @Input('etRepeat')
  get repeatCount(): number {
    return this._repeatCount;
  }
  set repeatCount(value: NumberInput) {
    this._repeatCount = coerceNumberProperty(value);
    this._render();
  }
  private _repeatCount = 2;

  constructor(private _mainTemplateRef: TemplateRef<unknown>, private _viewContainerRef: ViewContainerRef) {}

  private _render() {
    this._viewContainerRef.clear();

    for (let i = 0; i < this.repeatCount; i++) {
      this._viewContainerRef.createEmbeddedView(this._mainTemplateRef);
    }
  }
}
