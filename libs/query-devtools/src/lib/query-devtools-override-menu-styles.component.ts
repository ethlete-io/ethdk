import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The override menu's trigger chrome, as a styles-only component the menu mounts itself - a session
 * that never opens the value explorer's override menu does not inject it.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-override-menu-styles',
  template: '',
  styleUrl: './query-devtools-override-menu-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsOverrideMenuStylesComponent {}
