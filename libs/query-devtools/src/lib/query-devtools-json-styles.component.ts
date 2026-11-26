import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The value explorer's tree chrome, as a styles-only component the tree mounts itself - a session that
 * never opens a JSON view does not inject it.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-json-styles',
  template: '',
  styleUrl: './query-devtools-json-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsJsonStylesComponent {}
