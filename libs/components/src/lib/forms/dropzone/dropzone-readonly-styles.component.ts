import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The readonly dropzone chrome - the solid trigger border, the empty-state icon/text and the
 * height/visibility rules that only apply once a dropzone is view-only - as a styles-only
 * component. Mounted the first time a dropzone turns readonly, so a writable dropzone never pays
 * for it.
 *
 * @internal
 */
@Component({
  selector: 'et-dropzone-readonly-styles',
  template: '',
  styleUrl: './dropzone-readonly-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class DropzoneReadonlyStylesComponent {}

/** @internal */
export const mountDropzoneReadonlyStyles = () => injectStyleManager().mount(DropzoneReadonlyStylesComponent);
