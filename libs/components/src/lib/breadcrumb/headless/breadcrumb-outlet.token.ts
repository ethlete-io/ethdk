import { InjectionToken, Signal, TemplateRef } from '@angular/core';

export type BreadcrumbOutletHost = {
  separatorTemplate: Signal<{ templateRef: TemplateRef<unknown> } | undefined>;
};

export const BREADCRUMB_OUTLET_TOKEN = new InjectionToken<BreadcrumbOutletHost>('BREADCRUMB_OUTLET_TOKEN');
