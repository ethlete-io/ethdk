import { Component, ViewEncapsulation } from '@angular/core';
import { ACCORDION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-accordion-default-example',
  template: `
    <et-accordion-group class="example-accordion">
      <et-accordion label="How long does shipping take?" isOpenByDefault>
        Orders leave the warehouse within a day and arrive in two to four working days. Everything after that is the
        courier's estimate, which you get by mail as soon as the parcel is scanned.
      </et-accordion>

      <et-accordion>
        <ng-template etAccordionLabel>Returns <small>(30 days)</small></ng-template>
        <ng-template etAccordionHint>3 items</ng-template>

        Send anything back within 30 days. The parcel includes a prepaid label; drop it at any pickup point and the
        refund follows within a week of it arriving.
      </et-accordion>

      <et-accordion label="Do you ship outside the EU?" disabled>
        Not yet - which is why this header refuses to open.
      </et-accordion>
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
export class AccordionDefaultExampleComponent {}
