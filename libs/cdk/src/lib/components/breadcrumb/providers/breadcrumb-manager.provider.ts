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

export const provideBreadcrumbManager = /* @__PURE__ */ toProvideFn(BREADCRUMB_MANAGER_DEF);
export const injectBreadcrumbManager = /* @__PURE__ */ toInjectFn(BREADCRUMB_MANAGER_DEF);
