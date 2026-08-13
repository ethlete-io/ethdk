import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The expandable step/item row shared by the Sequences and Batches tabs, as a styles-only component each
 * of them mounts. It cannot live in either tab's own stylesheet: a tab's CSS is injected when that tab is
 * first opened, so the Batches tab would render unstyled rows until Sequences had been visited.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-step-styles',
  template: '',
  styleUrl: './query-devtools-step-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsStepStylesComponent {}
