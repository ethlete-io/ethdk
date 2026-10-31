import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { AutoSurfaceDirective, ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { IconDirective, PLUS_ICON, provideIcons } from '../../icon';
import { ACCORDION_IMPORTS } from '../accordion.imports';

@Component({
  selector: 'et-sb-accordion',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <et-accordion-group
        [autoCloseOthers]="autoCloseOthers()"
        [preventCloseLast]="preventCloseLast()"
        [style.max-inline-size.px]="560"
      >
        <et-accordion label="How long does shipping take?" isOpenByDefault>
          Orders leave the warehouse within a day and arrive in two to four working days. Everything after that is the
          courier's estimate, which you get by mail as soon as the parcel is scanned.
        </et-accordion>

        <!-- A label template instead of the plain label input, plus a hint on the right. -->
        <et-accordion>
          <ng-template etAccordionLabel> Returns <span class="text-small font-normal">(30 days)</span> </ng-template>
          <ng-template etAccordionHint>3 items</ng-template>

          Send anything back within 30 days. The parcel includes a prepaid label; drop it at any pickup point and the
          refund follows within a week of it arriving.
        </et-accordion>

        <et-accordion label="Do you ship outside the EU?" disabled>
          Not yet - which is why this header refuses to open. It stays focusable and is announced as disabled rather
          than being skipped over.
        </et-accordion>
      </et-accordion-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, ProvideSurfaceDirective],
})
export class AccordionStorybookComponent {
  public surface = input('dark');
  public autoCloseOthers = input(false);
  public preventCloseLast = input(false);
}

let creationOrder = 0;

/** Stands in for something worth deferring - it records when, and in which order, it was constructed. */
@Component({
  selector: 'et-sb-accordion-expensive',
  template: `<p class="text-small">
    The {{ label() }} content was constructed #{{ ordinal() }}, at {{ constructedAt() }}.
  </p>`,
  encapsulation: ViewEncapsulation.None,
})
export class AccordionExpensiveStorybookComponent {
  public label = input('');
  protected ordinal = signal(++creationOrder);
  protected constructedAt = signal(new Date().toISOString().slice(11, 23));
}

@Component({
  selector: 'et-sb-accordion-lazy',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <et-accordion-group [style.max-inline-size.px]="560">
        <et-accordion label="Projected content (created up front)">
          <et-sb-accordion-expensive label="projected" />
        </et-accordion>

        <et-accordion label="Deferred content (created on first expand)">
          <ng-template etAccordionContent>
            <et-sb-accordion-expensive label="deferred" />
          </ng-template>
        </et-accordion>
      </et-accordion-group>

      <p class="text-small">
        Both panels hold the same component. Open the second one and watch its "constructed at" stamp: it only exists
        from the first expand onwards, while the first panel's stamp is as old as the page.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, ProvideSurfaceDirective, AccordionExpensiveStorybookComponent],
})
export class AccordionLazyStorybookComponent {
  public surface = input('dark');
}

@Component({
  selector: 'et-sb-accordion-headless',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium p-8 font-sans">
      <div [style.max-inline-size.px]="560" class="et-sb-steps" etAccordionGroup etProvideColor="brand" autoCloseOthers>
        @for (step of STEPS; track step.title; let index = $index) {
          <div #accordion="etAccordion" class="et-sb-step" etAccordion etAutoSurface>
            <h3 class="et-sb-step-heading">
              <button class="et-sb-step-trigger" etAccordionTrigger type="button">
                <span class="et-sb-step-number">{{ index + 1 }}</span>
                <span class="et-sb-step-text">
                  <span class="et-sb-step-title">{{ step.title }}</span>
                  <span class="et-sb-step-summary">{{ step.summary }}</span>
                </span>
                <i class="et-sb-step-icon" etIcon="et-plus"></i>
              </button>
            </h3>

            <div class="et-sb-step-panel" etAccordionPanel>
              <div class="et-sb-step-clip">
                <p class="et-sb-step-body">{{ step.body }}</p>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, ProvideSurfaceDirective, ProvideColorDirective, AutoSurfaceDirective, IconDirective],
  providers: [provideIcons(PLUS_ICON)],
  styles: `
    .et-sb-steps {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .et-sb-step {
      border-radius: 16px;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 1px transparent;
      transition:
        background-color 120ms ease,
        box-shadow 160ms ease;

      &:has(> .et-sb-step-heading > .et-sb-step-trigger:hover) {
        background: color-mix(in srgb, var(--et-surface-interaction-solid) 6%, var(--et-surface-background-solid));
      }

      &[data-open] {
        box-shadow: inset 0 0 0 1px var(--et-theme-color-primary-solid);
      }
    }

    .et-sb-step-heading {
      margin: 0;
    }

    .et-sb-step-trigger {
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
        outline: 2px solid
          light-dark(var(--et-theme-color-ink-solid, currentColor), var(--et-theme-color-primary-solid, currentColor));
        outline-offset: 2px;
      }
    }

    .et-sb-step-number {
      display: grid;
      flex: none;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--et-theme-color-primary-solid) 18%, transparent);
      color: var(--et-theme-color-primary-solid);
      font-weight: 600;
      transition:
        background-color 160ms ease,
        color 160ms ease;

      [aria-expanded='true'] & {
        background: var(--et-theme-color-primary);
        color: var(--et-theme-color-on-primary);
      }
    }

    .et-sb-step-text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }

    .et-sb-step-title {
      font-weight: 600;
    }

    .et-sb-step-summary {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }

    .et-sb-step-icon {
      flex: none;
      inline-size: 16px;
      block-size: 16px;
      color: var(--et-surface-color-muted-solid);

      [aria-expanded='true'] & {
        rotate: 45deg;
        color: var(--et-theme-color-primary-solid);
      }
    }

    .et-sb-step-panel {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;

      &[data-open] {
        grid-template-rows: 1fr;
        opacity: 1;
      }
    }

    .et-sb-step-clip {
      min-block-size: 0;
      overflow: hidden;
    }

    .et-sb-step-body {
      margin: 0;
      padding: 0 16px 16px 62px;
      color: var(--et-surface-color-muted-solid);
    }

    @media (prefers-reduced-motion: no-preference) {
      .et-sb-step[data-can-animate] {
        .et-sb-step-panel {
          transition:
            grid-template-rows 360ms cubic-bezier(0.2, 0, 0, 1),
            opacity 240ms ease;
        }

        .et-sb-step-icon {
          transition:
            rotate 360ms cubic-bezier(0.2, 0, 0, 1),
            color 160ms ease;
        }
      }
    }
  `,
})
export class AccordionHeadlessStorybookComponent {
  public surface = input('dark');

  protected readonly STEPS = [
    {
      title: 'Create your account',
      summary: 'Email and a password',
      body: 'The directives only own the open state, the ids and the inert panel. Every pixel here - the cards, the numbers, the plus that turns into a cross - is this template.',
    },
    {
      title: 'Pick a plan',
      summary: 'Switch any time',
      body: 'The panel stays mounted and animates its own grid track and opacity off data-open, gated on data-can-animate so an initially open step does not animate in.',
    },
    {
      title: 'Invite your team',
      summary: 'Optional',
      body: 'autoCloseOthers on the group keeps one step open at a time, and the arrow keys move between the headers.',
    },
  ];
}
