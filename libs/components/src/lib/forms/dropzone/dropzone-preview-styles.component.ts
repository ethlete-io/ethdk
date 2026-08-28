import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The single-file preview overlay - the image/file-icon frame, the sliding name/size/progress band
 * and its action-button corner - as a styles-only component. Mounted the first time a dropzone
 * renders a single-file preview, so a dropzone that is always in multiple mode, or has never held a
 * file, never pays for it.
 *
 * @internal
 */
@Component({
  selector: 'et-dropzone-preview-styles',
  template: '',
  styleUrl: './dropzone-preview-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DropzonePreviewStylesComponent {}

/** @internal */
export const mountDropzonePreviewStyles = () => injectStyleManager().mount(DropzonePreviewStylesComponent);
