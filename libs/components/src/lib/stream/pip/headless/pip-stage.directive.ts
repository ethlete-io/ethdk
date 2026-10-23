import { Directive, inject } from '@angular/core';
import { mountPipStageStyles } from '../pip-stage-styles.component';
import { PIP_CHROME_REF_TOKEN } from './pip-chrome-ref.token';

@Directive({
  selector: '[etPipStage]',
  host: {
    class: 'et-stream-pip-chrome__stage',
    '[class.et-stream-pip-chrome__stage--grid]': 'chrome.state.multiView()',
    '[style.--et-pip-grid-cols]': 'chrome.state.gridCols()',
    '[style.--et-pip-grid-rows]': 'chrome.state.gridRows()',
  },
})
export class PipStageDirective {
  protected chrome = inject(PIP_CHROME_REF_TOKEN);

  constructor() {
    mountPipStageStyles();
  }
}
