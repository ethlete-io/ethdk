import { signal, TemplateRef } from '@angular/core';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';

const BREADCRUMB_MANAGER_DEF = /* @__PURE__ */ defineProvider(
  () => {
    const breadcrumbTemplateSignal = signal<TemplateRef<unknown> | null>(null);
    const breadcrumbTemplate = breadcrumbTemplateSignal.asReadonly();
    const setBreadcrumbTemplate = (tpl: TemplateRef<unknown> | null) => {
      breadcrumbTemplateSignal.set(tpl);
    };

    return {
      breadcrumbTemplate,
      setBreadcrumbTemplate,
    };
  },
  { name: 'Breadcrumb Manager' },
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideBreadcrumbManager = /* @__PURE__ */ toProvideFn(BREADCRUMB_MANAGER_DEF);
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const injectBreadcrumbManager = /* @__PURE__ */ toInjectFn(BREADCRUMB_MANAGER_DEF);
