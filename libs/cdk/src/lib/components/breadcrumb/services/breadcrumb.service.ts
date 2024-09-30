import { Injectable, signal, TemplateRef } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class BreadcrumbService {
  #breadcrumbTemplate = signal<TemplateRef<unknown> | null>(null);
  breadcrumbTemplate = this.#breadcrumbTemplate.asReadonly();

  setBreadcrumbTemplate(tpl: TemplateRef<unknown> | null) {
    this.#breadcrumbTemplate.set(tpl);
  }
}
