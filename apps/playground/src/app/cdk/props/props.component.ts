import { ChangeDetectionStrategy, Component, Injector, ViewEncapsulation, inject, input, signal } from '@angular/core';
import {
  ArchTestAccordionComponent,
  ArchTestAccordionItemComponent,
  ArchTestOverlayTriggerDirective,
} from '../arch/arch.component';

@Component({
  selector: 'ethlete-overlay-test-component',
  template: `<p>Test</p>
    <p>{{ foo() }}</p> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [],
  hostDirectives: [],
})
export class TestCompComponent {
  foo = input();
}

@Component({
  selector: 'ethlete-props-test',
  template: `
    <ethlete-arch-test-accordion>
      <ethlete-arch-test-accordion-item [isExpanded]="true" label="Accordion 1">
        <p>Some accordion stuff</p>
      </ethlete-arch-test-accordion-item>
      <ethlete-arch-test-accordion-item label="Lorem accordion ipsum">
        <p>
          Some accordion stuff Lorem ipsum dolor sit amet consectetur adipisicing elit. Repudiandae eligendi consequatur
          voluptate dolore autem debitis laboriosam alias, odit voluptates voluptatibus.
        </p>
      </ethlete-arch-test-accordion-item>
      <ethlete-arch-test-accordion-item label="Short ipsum">
        <p>Some accordion stuff Lorem ipsum dolor, sit amet consectetur adipisicing elit. Quis, omnis.</p>
      </ethlete-arch-test-accordion-item>

      @if (showFourth()) {
        <ethlete-arch-test-accordion-item [disabled]="true" label="Number 4">
          <p>Some accordion stuff Lorem ipsum dolor, sit amet consectetur adipisicing elit. Quis, omnis.</p>
        </ethlete-arch-test-accordion-item>
      }
    </ethlete-arch-test-accordion>

    <button ethleteOverlayTrigger="Text content">overlay text</button>

    <ng-template #overlayTpl let-foo="foo">
      <p>Template {{ foo }}</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    </ng-template>

    <button [ethleteOverlayTrigger]="overlayTpl">overlay template</button>

    <button [ethleteOverlayTrigger]="{ template: overlayTpl, context: { foo: 'with context' }, injector }">
      overlay template custom
    </button>

    <button [ethleteOverlayTrigger]="comp">overlay component</button>

    <button [ethleteOverlayTrigger]="{ component: comp, inputs: { foo: 'with context' }, injector }">
      overlay component custom
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ArchTestAccordionComponent, ArchTestAccordionItemComponent, ArchTestOverlayTriggerDirective],
  hostDirectives: [],
})
export class PropsTestComponent {
  injector = inject(Injector);
  showFourth = signal(false);

  comp = TestCompComponent;

  constructor() {
    setTimeout(() => {
      this.showFourth.set(true);
    }, 1000);
  }
}
