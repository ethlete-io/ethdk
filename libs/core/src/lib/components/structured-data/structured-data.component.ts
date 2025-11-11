import { ChangeDetectionStrategy, Component, HostBinding, inject, Input, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { JsonLD } from '@ethlete/types';

@Component({
  selector: 'et-structured-data',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    style: 'display: none',
  },
})
export class StructuredDataComponent {
  private readonly _sanitizer = inject(DomSanitizer);

  @Input()
  set data(currentValue: JsonLD.WithContext<JsonLD.Thing> | JsonLD.Graph | null | undefined) {
    this.jsonLD = this.getSafeHTML(currentValue);
  }

  @HostBinding('innerHTML')
  jsonLD?: SafeHtml;

  getSafeHTML(value: JsonLD.WithContext<JsonLD.Thing> | JsonLD.Graph | null | undefined) {
    const json = value ? JSON.stringify(value, null, 2).replace(/<\/script>/g, '<\\/script>') : '';
    const html = `<script type="application/ld+json">${json}</script>`;
    return this._sanitizer.bypassSecurityTrustHtml(html);
  }
}
