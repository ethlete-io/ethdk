import { coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[etRepeat]',
  standalone: true,
})
export class RepeatDirective implements OnInit {
  @Input('etRepeat')
  get repeatCount(): number {
    return this._repeatCount;
  }
  set repeatCount(value: NumberInput) {
    this._repeatCount = coerceNumberProperty(value);
  }
  private _repeatCount = 2;

  constructor(private _mainTemplateRef: TemplateRef<unknown>, private _viewContainerRef: ViewContainerRef) {}

  ngOnInit(): void {
    this._render();
  }

  private _render() {
    for (let i = 0; i < this.repeatCount; i++) {
      this._viewContainerRef.createEmbeddedView(this._mainTemplateRef);
    }
  }
}
