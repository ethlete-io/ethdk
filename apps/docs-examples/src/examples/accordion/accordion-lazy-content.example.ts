import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ACCORDION_IMPORTS } from '@ethlete/components';

let creationOrder = 0;

@Component({
  selector: 'app-accordion-stamp',
  template: `<p>The {{ label() }} content was constructed #{{ ordinal() }}, at {{ constructedAt() }}.</p>`,
  encapsulation: ViewEncapsulation.None,
})
export class AccordionStampComponent {
  public label = input('');
  protected ordinal = signal(++creationOrder);
  protected constructedAt = signal(new Date().toISOString().slice(11, 23));
}

@Component({
  selector: 'app-accordion-lazy-content-example',
  template: `
    <et-accordion-group class="example-accordion">
      <et-accordion label="Projected content (created up front)">
        <app-accordion-stamp label="projected" />
      </et-accordion>

      <et-accordion label="Deferred content (created on first expand)">
        <ng-template etAccordionContent>
          <app-accordion-stamp label="deferred" />
        </ng-template>
      </et-accordion>
    </et-accordion-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, AccordionStampComponent],
  styles: `
    .example-accordion {
      max-inline-size: 560px;
    }
  `,
})
export class AccordionLazyContentExampleComponent {}
