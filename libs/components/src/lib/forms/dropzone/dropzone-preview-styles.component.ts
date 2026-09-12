import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

@Component({
  selector: 'et-dropzone-preview-styles',
  template: '',
  styleUrl: './dropzone-preview-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DropzonePreviewStylesComponent {}

/** @internal */
export const mountDropzonePreviewStyles = () => injectStyleManager().mount(DropzonePreviewStylesComponent);
