import { TemplateRef, signal } from '@angular/core';
import { createProvider } from '@ethlete/core';

/**
 * The hand-off between the page that knows its trail and the shell that renders it: a page registers
 * its `<ng-template etBreadcrumbTemplate>`, the single `<et-breadcrumb-outlet>` in the shell renders
 * whatever is registered.
 *
 * Provide it once, above both — typically in the app config or the shell route:
 *
 * @example
 * providers: [provideBreadcrumbManager()]
 */
export const [provideBreadcrumbManager, injectBreadcrumbManager] = createProvider(
  () => {
    const registeredTemplate = signal<TemplateRef<unknown> | null>(null);

    return {
      /** The trail the outlet is currently rendering, or `null` when no page has registered one. */
      template: registeredTemplate.asReadonly(),

      /** @internal Set by `etBreadcrumbTemplate` while the declaring page is alive. */
      setTemplate: (template: TemplateRef<unknown> | null) => registeredTemplate.set(template),
    };
  },
  { name: 'Breadcrumb Manager' },
);
