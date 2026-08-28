import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The breadcrumb row shown once a deep drill collapses levels out of the column window, as a
 * styles-only component mounted the first time a cascader has a breadcrumb path to render.
 *
 * @internal
 */
@Component({
  selector: 'et-cascader-breadcrumb-styles',
  template: '',
  styleUrl: './cascader-breadcrumb-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CascaderBreadcrumbStylesComponent {}
