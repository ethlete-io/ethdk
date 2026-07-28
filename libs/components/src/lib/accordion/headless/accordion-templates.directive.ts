import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { ACCORDION_ERROR_CODES } from '../accordion-errors';
import { ACCORDION_TOKEN } from './accordion.tokens';
import { registerPart } from './internals/register-part';

/** `'AccordionLabelDirective'` → the `etAccordionLabel` selector it is applied with. */
const selectorOf = (directiveName: string) => `et${directiveName.replace('Directive', '')}`;

const assertInsideAccordion = (accordion: unknown, directiveName: string) => {
  if (ngDevMode) {
    afterNextRender(() => {
      if (!accordion) {
        throw new RuntimeError(
          ACCORDION_ERROR_CODES.PART_OUTSIDE_ACCORDION,
          `[${directiveName}] ${selectorOf(directiveName)} must be placed inside an [etAccordion] element ` +
            '(e.g. <et-accordion>).',
        );
      }
    });
  }
};

/**
 * Replaces the default accordion's plain-text `label` with a template, for a header that needs markup
 * — an icon, a badge, a count.
 *
 * @example
 * <et-accordion>
 *   <ng-template etAccordionLabel>
 *     <et-icon name="warning" /> Unsaved changes
 *   </ng-template>
 *   …
 * </et-accordion>
 */
@Directive({
  selector: 'ng-template[etAccordionLabel]',
  exportAs: 'etAccordionLabel',
})
export class AccordionLabelDirective {
  private accordion = inject(ACCORDION_TOKEN, { optional: true });
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    registerPart(this.accordion?.labelTemplate, this);

    assertInsideAccordion(this.accordion, 'AccordionLabelDirective');
  }
}

/**
 * Secondary header content, rendered between the label and the chevron of the default accordion — a
 * summary of what's inside ("3 items", "Optional"), not a second label.
 */
@Directive({
  selector: 'ng-template[etAccordionHint]',
  exportAs: 'etAccordionHint',
})
export class AccordionHintDirective {
  private accordion = inject(ACCORDION_TOKEN, { optional: true });
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    registerPart(this.accordion?.hintTemplate, this);

    assertInsideAccordion(this.accordion, 'AccordionHintDirective');
  }
}

/**
 * Panel content that is only created the first time the accordion expands — use it instead of
 * projecting the content directly when the panel holds something expensive (a table, a chart, a
 * component that fetches).
 *
 * Projected content (plain children of `<et-accordion>`) is created with its parent, whether the
 * panel ever opens or not; a template isn't. Once created it stays mounted, so collapsing keeps the
 * content's state and has something to animate.
 *
 * @example
 * <et-accordion label="Revenue">
 *   <ng-template etAccordionContent>
 *     <app-revenue-chart />
 *   </ng-template>
 * </et-accordion>
 */
@Directive({
  selector: 'ng-template[etAccordionContent]',
  exportAs: 'etAccordionContent',
})
export class AccordionContentDirective {
  private accordion = inject(ACCORDION_TOKEN, { optional: true });
  public templateRef = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    registerPart(this.accordion?.contentTemplate, this);

    assertInsideAccordion(this.accordion, 'AccordionContentDirective');
  }
}
