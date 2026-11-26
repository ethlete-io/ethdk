import { Component, ViewEncapsulation } from '@angular/core';
import { AccordionImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-accordion-group-example',
  template: `
    <et-accordion-group autoCloseOthers>
      <et-accordion label="One"><p>Opening another panel closes this one.</p></et-accordion>
      <et-accordion label="Two"><p>Only one panel is open at a time.</p></et-accordion>
      <et-accordion label="Three"><p>Without autoCloseOthers they stay independent.</p></et-accordion>
    </et-accordion-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AccordionImports],
})
export class CdkAccordionGroupExampleComponent {}
