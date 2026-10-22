import { Component, ViewEncapsulation } from '@angular/core';
import { ACCORDION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-accordion-headless-example',
  template: `
    <div class="example-headless-group" etAccordionGroup autoCloseOthers>
      @for (section of SECTIONS; track section.title) {
        <div #accordion="etAccordion" class="example-headless-item" etAccordion>
          <h3>
            <button class="example-headless-trigger" etAccordionTrigger type="button">
              {{ section.title }}
              <span>{{ accordion.isOpen() ? 'Hide' : 'Show' }}</span>
            </button>
          </h3>

          @if (accordion.isOpen()) {
            <div class="example-headless-panel" etAccordionPanel>{{ section.body }}</div>
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS],
  styles: `
    .example-headless-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-inline-size: 560px;
    }

    .example-headless-item {
      border: 1px solid currentColor;
      border-radius: 8px;
    }

    .example-headless-item h3 {
      margin: 0;
    }

    .example-headless-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      inline-size: 100%;
      padding: 16px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
    }

    .example-headless-panel {
      padding: 0 16px 16px;
    }
  `,
})
export class AccordionHeadlessExampleComponent {
  protected readonly SECTIONS = [
    { title: 'Own markup', body: 'No heading wrapper, no chevron, no separators - just the two directives.' },
    { title: 'Own animation', body: 'This one swaps the panel in and out instead of animating a height.' },
  ];
}
