import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The copy menu's caret chrome, as a styles-only component the menu mounts itself - a session that
 * never opens a value explorer does not inject it.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-copy-menu-styles',
  template: '',
  styleUrl: './query-devtools-copy-menu-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsCopyMenuStylesComponent {}
