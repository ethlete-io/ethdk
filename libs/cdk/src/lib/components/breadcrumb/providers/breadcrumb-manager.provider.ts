import { signal, TemplateRef } from '@angular/core';
import { createProvider } from '@ethlete/core';

export const [provideBreadcrumbManager, injectBreadcrumbManager] = createProvider(
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
