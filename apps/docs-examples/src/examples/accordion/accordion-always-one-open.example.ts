import { Component, ViewEncapsulation } from '@angular/core';
import { ACCORDION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-accordion-always-one-open-example',
  template: `
    <et-accordion-group class="example-accordion" autoCloseOthers preventCloseLast>
      <et-accordion label="How long does shipping take?" isOpenByDefault>
        Orders leave the warehouse within a day and arrive in two to four working days.
      </et-accordion>

      <et-accordion label="Returns">
        Send anything back within 30 days. The refund follows within a week of the parcel arriving.
      </et-accordion>

      <et-accordion label="Do you ship outside the EU?">Not yet.</et-accordion>
    </et-accordion-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS],
  styles: `
    .example-accordion {
      max-inline-size: 560px;
    }
  `,
})
export class AccordionAlwaysOneOpenExampleComponent {}
