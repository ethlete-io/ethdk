import { ChangeDetectionStrategy, Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { JsonLD } from '@ethlete/types';

@Component({
  selector: 'et-structured-data',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    style: 'display: none',
    '[innerHTML]': 'jsonLD()',
  },
})
export class StructuredDataComponent {
  private sanitizer = inject(DomSanitizer);

  data = input<JsonLD.WithContext<JsonLD.Thing> | JsonLD.Graph | null | undefined>(null);

  jsonLD = computed(() => {
    const data = this.data();

    if (!data) {
      return null;
    }

    const json = data ? JSON.stringify(data, null, 2).replace(/<\/script>/g, '<\\/script>') : '';
    const html = `<script type="application/ld+json">${json}</script>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });
}
