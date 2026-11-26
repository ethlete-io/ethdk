import { Component, ViewEncapsulation } from '@angular/core';
import { AccordionImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-accordion-default-example',
  template: `
    <et-accordion label="Plain label" isOpenByDefault>
      <p>The panel animates to its natural height, and the header is a real button with aria-expanded.</p>
    </et-accordion>

    <et-accordion>
      <ng-template et-accordion-label-wrapper>
        <span et-accordion-label>Custom <strong>label</strong></span>
      </ng-template>

      <p>A label template replaces the plain-text label.</p>
    </et-accordion>

    <et-accordion label="With a hint">
      <ng-template et-accordion-hint-wrapper>
        <span et-accordion-hint>3 items</span>
      </ng-template>

      <p>A hint template adds text on the right side of the header.</p>
    </et-accordion>

    <et-accordion label="Disabled" disabled>
      <p>Never visible.</p>
    </et-accordion>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AccordionImports],
})
export class CdkAccordionDefaultExampleComponent {}
