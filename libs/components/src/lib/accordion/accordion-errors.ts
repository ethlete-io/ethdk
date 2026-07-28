// codes 3600-3699
export const ACCORDION_ERROR_CODES = {
  /** An accordion part (`etAccordionTrigger`, `etAccordionPanel`, a slot template) was used outside an `[etAccordion]`. */
  PART_OUTSIDE_ACCORDION: 3600,
  /** An `[etAccordion]` rendered no `etAccordionTrigger`, so nothing can expand it. */
  MISSING_TRIGGER: 3601,
  /** An `[etAccordion]` rendered no `etAccordionPanel`, so it has nothing to expand. */
  MISSING_PANEL: 3602,
} as const;
