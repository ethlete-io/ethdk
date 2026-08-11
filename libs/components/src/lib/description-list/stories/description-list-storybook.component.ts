import { Component, input, ViewEncapsulation } from '@angular/core';
import { DescriptionListVariant } from '../description-list.component';
import { DESCRIPTION_LIST_IMPORTS } from '../description-list.imports';

@Component({
  selector: 'et-sb-description-list',
  template: `
    <div [style.max-inline-size.px]="420" class="p-8 font-sans">
      <dl [variant]="variant()" et-description-list>
        <dt>Name</dt>
        <dd>Jane Doe</dd>
        <dt>Email</dt>
        <dd>jane&#64;example.com</dd>
        <dt>Role</dt>
        <dd>Administrator</dd>
        <dt>Notes</dt>
        <dd>Joined during the private beta and has opted into every early-access feature flag.</dd>
      </dl>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...DESCRIPTION_LIST_IMPORTS],
})
export class DescriptionListStorybookComponent {
  public variant = input<DescriptionListVariant>('inline');
}
