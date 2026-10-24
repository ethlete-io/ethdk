import { Component, ViewEncapsulation } from '@angular/core';
import { ACCORDION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-accordion-headless-example',
  template: `
    <div class="example-headless-group" etAccordionGroup autoCloseOthers>
      @for (step of STEPS; track step.title; let index = $index) {
        <div class="example-headless-item" etAccordion>
          <h3 class="example-headless-heading">
            <button class="example-headless-trigger" etAccordionTrigger type="button">
              <span class="example-headless-number">{{ index + 1 }}</span>
              <span class="example-headless-text">
                <span class="example-headless-title">{{ step.title }}</span>
                <span class="example-headless-summary">{{ step.summary }}</span>
              </span>
              <span class="example-headless-icon" aria-hidden="true">+</span>
            </button>
          </h3>

          <div class="example-headless-panel" etAccordionPanel>
            <div class="example-headless-clip">
              <p class="example-headless-body">{{ step.body }}</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS],
  styles: `
    .example-headless-group {
      --example-accent: #6d5dfc;

      display: flex;
      flex-direction: column;
      gap: 8px;
      max-inline-size: 560px;
    }

    .example-headless-item {
      border-radius: 16px;
      background: color-mix(in srgb, currentColor 5%, transparent);
      box-shadow: inset 0 0 0 1px transparent;
      transition: box-shadow 160ms ease;

      &[data-open] {
        box-shadow: inset 0 0 0 1px var(--example-accent);
      }
    }

    .example-headless-heading {
      margin: 0;
    }

    .example-headless-trigger {
      display: flex;
      align-items: center;
      gap: 14px;
      inline-size: 100%;
      padding: 14px 16px;
      border: 0;
      border-radius: 16px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--example-accent);
        outline-offset: 2px;
      }
    }

    .example-headless-number {
      display: grid;
      flex: none;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--example-accent) 18%, transparent);
      color: var(--example-accent);
      font-weight: 600;

      [aria-expanded='true'] & {
        background: var(--example-accent);
        color: #fff;
      }
    }

    .example-headless-text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }

    .example-headless-title {
      font-weight: 600;
    }

    .example-headless-summary {
      font-size: 13px;
      opacity: 0.65;
    }

    .example-headless-icon {
      flex: none;
      font-size: 20px;
      line-height: 1;
      opacity: 0.65;

      [aria-expanded='true'] & {
        rotate: 45deg;
        color: var(--example-accent);
        opacity: 1;
      }
    }

    .example-headless-panel {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;

      &[data-open] {
        grid-template-rows: 1fr;
        opacity: 1;
      }
    }

    .example-headless-clip {
      min-block-size: 0;
      overflow: hidden;
    }

    .example-headless-body {
      margin: 0;
      padding: 0 16px 16px 62px;
      opacity: 0.75;
    }

    @media (prefers-reduced-motion: no-preference) {
      .example-headless-item[data-can-animate] {
        .example-headless-panel {
          transition:
            grid-template-rows 360ms cubic-bezier(0.2, 0, 0, 1),
            opacity 240ms ease;
        }

        .example-headless-icon {
          transition:
            rotate 360ms cubic-bezier(0.2, 0, 0, 1),
            color 160ms ease;
        }
      }
    }
  `,
})
export class AccordionHeadlessExampleComponent {
  protected readonly STEPS = [
    {
      title: 'Own markup',
      summary: 'Two directives, nothing else',
      body: 'No heading wrapper, no chevron, no separators - the cards, the numbers and the plus that turns into a cross are this template.',
    },
    {
      title: 'Own animation',
      summary: 'Grid track and opacity',
      body: 'The panel stays mounted and animates its own grid track and opacity off data-open, gated on data-can-animate so an initially open step does not animate in.',
    },
    {
      title: 'One at a time',
      summary: 'autoCloseOthers',
      body: 'The group keeps a single step open and the arrow keys move between the headers.',
    },
  ];
}
