import { Component, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';

/** @internal */
@Component({
  selector: 'et-pip-stage-styles',
  template: '',
  styleUrl: './pip-stage-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class PipStageStylesComponent {}

/** @internal */
export const mountPipStageStyles = () => injectStyleManager().mount(PipStageStylesComponent);
