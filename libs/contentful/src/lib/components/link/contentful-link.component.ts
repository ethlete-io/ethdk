import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONTENTFUL_CONFIG } from '../../constants/contentful.constants';
import { createContentfulConfig } from '../../utils/contentful-config';

const getPrimaryDomain = (host: string): string => {
  const parts = host.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : host;
};

@Component({
  selector: 'et-contentful-link',
  template: `
    @if (isExternal()) {
      <a
        [class]="linkClass()"
        [href]="href()"
        [target]="openInNewTab() ? '_blank' : null"
        [rel]="openInNewTab() ? 'noopener noreferrer' : null"
        >{{ text() }}</a
      >
    } @else {
      <a [class]="linkClass()" [routerLink]="internalPath()">{{ text() }}</a>
    }
  `,
  host: {
    style: 'display: contents',
  },
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ContentfulLinkComponent {
  private readonly _document = inject(DOCUMENT);
  private readonly _config = inject(CONTENTFUL_CONFIG, { optional: true }) ?? createContentfulConfig();

  href = input.required<string>();
  text = input.required<string>();
  textClass = input('');

  isExternal = computed(() => {
    const href = this.href();
    const isAbsolute = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');

    if (!isAbsolute) return false;

    try {
      const parsed = new URL(href.startsWith('//') ? `https:${href}` : href);
      const internalHosts = [this._document.location.host, ...this._config.internalHosts];
      return !internalHosts.includes(parsed.host);
    } catch {
      return true;
    }
  });

  openInNewTab = computed(() => {
    if (!this.isExternal()) return false;

    const href = this.href();

    try {
      const parsed = new URL(href.startsWith('//') ? `https:${href}` : href);
      const internalPrimaryDomains = [
        getPrimaryDomain(this._document.location.host),
        ...this._config.internalHosts.map(getPrimaryDomain),
      ];
      return !internalPrimaryDomains.includes(getPrimaryDomain(parsed.host));
    } catch {
      return true;
    }
  });

  internalPath = computed(() => {
    const href = this.href();

    if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//')) {
      return href;
    }

    try {
      const url = new URL(href.startsWith('//') ? `https:${href}` : href);
      return url.pathname + url.search + url.hash;
    } catch {
      return href;
    }
  });

  linkClass = computed(() => {
    const base = 'et-contentful-rich-text-default-element et-contentful-rich-text-default-a';
    const extra = this.textClass();

    return extra ? `${base} ${extra}` : base;
  });
}
