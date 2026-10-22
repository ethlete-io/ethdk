export const ACCORDION_EXAMPLES = {
  'accordion/accordion-default': () =>
    import('./accordion-default.example').then((m) => m.AccordionDefaultExampleComponent),
  'accordion/accordion-always-one-open': () =>
    import('./accordion-always-one-open.example').then((m) => m.AccordionAlwaysOneOpenExampleComponent),
  'accordion/accordion-lazy-content': () =>
    import('./accordion-lazy-content.example').then((m) => m.AccordionLazyContentExampleComponent),
  'accordion/accordion-headless': () =>
    import('./accordion-headless.example').then((m) => m.AccordionHeadlessExampleComponent),
};
