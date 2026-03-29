import { Directive, inject } from '@angular/core';
import { PIP_CHROME_REF_TOKEN } from './pip-chrome-ref.token';

@Directive({
  selector: '[etPipStage]',
  host: {
    class: 'et-stream-pip-chrome__stage',
    '[style.--et-pip-grid-cols]': 'chrome.state.gridCols()',
    '[style.--et-pip-grid-rows]': 'chrome.state.gridRows()',
  },
})
export class PipStageDirective {
  protected chrome = inject(PIP_CHROME_REF_TOKEN);
}
