import { Component, ViewEncapsulation } from '@angular/core';
import { DESCRIPTION_LIST_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-description-list-stacked-example',
  template: `
    <dl variant="stacked" et-description-list>
      <dt>Name</dt>
      <dd>Jane Doe</dd>
      <dt>Email</dt>
      <dd>jane&#64;example.com</dd>
      <dt>Role</dt>
      <dd>Administrator</dd>
      <dt>Notes</dt>
      <dd>Joined during the private beta and has opted into every early-access feature flag.</dd>
    </dl>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [DESCRIPTION_LIST_IMPORTS],
})
export class DescriptionListStackedExampleComponent {}
