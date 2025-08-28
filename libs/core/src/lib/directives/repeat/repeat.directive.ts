import { Directive, Input, numberAttribute, TemplateRef, ViewContainerRef, inject } from '@angular/core';

@Directive({
  selector: '[etRepeat]',
  standalone: true,
})
export class RepeatDirective {
  private _mainTemplateRef = inject<TemplateRef<unknown>>(TemplateRef);
  private _viewContainerRef = inject(ViewContainerRef);

  @Input('etRepeat')
  get repeatCount(): number {
    return this._repeatCount;
  }
  set repeatCount(value: unknown) {
    this._repeatCount = numberAttribute(value);
    this._render();
  }
  private _repeatCount = 2;

  private _render() {
    this._viewContainerRef.clear();

    for (let i = 0; i < this.repeatCount; i++) {
      this._viewContainerRef.createEmbeddedView(this._mainTemplateRef);
    }
  }
}
