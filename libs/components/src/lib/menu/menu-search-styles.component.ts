import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The search field's own chrome (input, spinner, error line, `--et-menu-search-height`), as a
 * styles-only component mounted by `MenuSearchDirective`. A menu without a search field still
 * renders the (empty) header wrapper - hiding it is `menu.component.css`'s job - so only the
 * field-specific rules move here.
 *
 * @internal
 */
@Component({
  selector: 'et-menu-search-styles',
  template: '',
  styleUrl: './menu-search-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class MenuSearchStylesComponent {}
