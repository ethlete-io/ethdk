import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/**
 * The support region under a form control - the clipped, height-animated box and the error, warning
 * and hint blocks that cross-fade inside it - as a styles-only component. Mounted once per document
 * by `FormSupportComponent`, so the controls that render a region share one stylesheet instead of
 * each carrying a near-identical copy.
 *
 * A control keeps its public `--et-<control>-support-*` tokens and aliases them onto the
 * `--et-form-support-*` tokens this sheet reads.
 *
 * @internal
 */
@Component({
  selector: 'et-form-support-styles',
  template: '',
  styleUrl: './form-support-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FormSupportStylesComponent {}

/** @internal */
export const mountFormSupportStyles = () => injectStyleManager().mount(FormSupportStylesComponent);
