import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import * as JsonLD from './json-ld';

@Component({
  selector: 'et-structured-data',
  template: '',
  encapsulation: ViewEncapsulation.None,
  host: {
    style: 'display: none',
    '[innerHTML]': 'jsonLD()',
  },
})
export class StructuredDataComponent {
  private sanitizer = inject(DomSanitizer);

  data = input<JsonLD.WithContext<JsonLD.Thing> | JsonLD.Graph | null | undefined>(null);

  protected jsonLD = computed(() => {
    const data = this.data();

    if (!data) {
      return null;
    }

    const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003C');
    const html = `<script type="application/ld+json">${json}</script>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });
}
