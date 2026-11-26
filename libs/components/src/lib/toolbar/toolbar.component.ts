import { Component, ViewEncapsulation } from '@angular/core';
import { ToolbarDirective } from './headless/toolbar.directive';

/**
 * A bar of related controls that share one tab stop, laid out in a row (or a column with
 * `orientation="vertical"`) and navigated with the arrow keys - see `[etToolbar]` for the keyboard
 * model. Group the controls inside it with `et-divider`.
 *
 * Pass an `aria-label` naming what the toolbar acts on; without one a screen reader announces only
 * that a toolbar is present.
 *
 * @example
 * <et-toolbar aria-label="Text formatting">
 *   <button et-icon-button type="button"><i etIcon="et-bold"></i></button>
 *   <button et-icon-button type="button"><i etIcon="et-italic"></i></button>
 *   <et-divider orientation="vertical" decorative />
 *   <button et-icon-button type="button"><i etIcon="et-link"></i></button>
 * </et-toolbar>
 */
@Component({
  selector: 'et-toolbar, [et-toolbar]',
  template: `<ng-content />`,
  styleUrl: './toolbar.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: ToolbarDirective,
      inputs: ['orientation'],
    },
  ],
  host: {
    class: 'et-toolbar',
  },
})
export class ToolbarComponent {}
