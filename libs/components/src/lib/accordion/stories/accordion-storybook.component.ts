import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
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
          Not yet — which is why this header refuses to open. It stays focusable and is announced as disabled rather
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

/** Stands in for something worth deferring — it records when, and in which order, it was constructed. */
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
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <!-- The same behavior with none of the default chrome: the directives own the state, the ARIA
           wiring and the inert panel, the template owns everything you can see. -->
      <div [style.max-inline-size.px]="560" class="flex flex-col gap-2" etAccordionGroup autoCloseOthers>
        @for (section of SECTIONS; track section.title) {
          <div #accordion="etAccordion" class="rounded-lg border border-white/15" etAccordion>
            <h3 class="m-0">
              <button
                class="text-medium flex w-full items-center justify-between gap-4 bg-transparent p-4 text-start font-sans text-inherit"
                etAccordionTrigger
                type="button"
              >
                {{ section.title }}
                <span class="text-small">{{ accordion.isOpen() ? 'Hide' : 'Show' }}</span>
              </button>
            </h3>

            @if (accordion.isOpen()) {
              <div class="text-small px-4 pb-4" etAccordionPanel>{{ section.body }}</div>
            }
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ACCORDION_IMPORTS, ProvideSurfaceDirective],
})
export class AccordionHeadlessStorybookComponent {
  public surface = input('dark');

  protected readonly SECTIONS = [
    { title: 'Own markup', body: 'No heading wrapper, no chevron, no separators — just the two directives.' },
    { title: 'Own animation', body: 'This one swaps the panel in and out instead of animating a height.' },
  ];
}
