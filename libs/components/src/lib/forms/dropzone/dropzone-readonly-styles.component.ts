import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

@Component({
  selector: 'et-dropzone-readonly-styles',
  template: '',
  styleUrl: './dropzone-readonly-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DropzoneReadonlyStylesComponent {}

/** @internal */
export const mountDropzoneReadonlyStyles = () => injectStyleManager().mount(DropzoneReadonlyStylesComponent);
