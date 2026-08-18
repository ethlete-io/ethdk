import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError, injectHostElement } from '@ethlete/core';
import { registerSingleton } from '../../form-field/headless';
import { COLOR_INPUT_ERROR_CODES } from '../color-input-errors';
import { COLOR_INPUT_TOKEN, ColorInputSurfaceContext } from './color-input.directive';

/** The template rendered inside a color control's picker overlay pane. */
@Directive({
  selector: 'ng-template[etColorPickerSurface]',
  exportAs: 'etColorPickerSurface',
})
export class ColorPickerSurfaceDirective {
  private colorInput = inject(COLOR_INPUT_TOKEN, { optional: true });
  public templateRef = inject<TemplateRef<ColorInputSurfaceContext>>(TemplateRef);
  private readonly hostElement = injectHostElement<Comment>();

  constructor() {
    registerSingleton(this.colorInput?.registeredSurface, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.colorInput) {
          throw new RuntimeError(
            COLOR_INPUT_ERROR_CODES.SURFACE_OUTSIDE_COLOR_INPUT,
            '[ColorPickerSurfaceDirective] etColorPickerSurface must be placed inside an [etColorInput] element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
