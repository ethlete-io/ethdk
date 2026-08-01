import { DOCUMENT } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectContentfulConfig } from '../../utils/contentful-config';

const getPrimaryDomain = (host: string) => {
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
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
  host: {
    style: 'display: contents',
  },
})
export class ContentfulLinkComponent {
  private document = inject(DOCUMENT);
  private readonly config = injectContentfulConfig();

  href = input.required<string>();
  text = input.required<string>();
  textClass = input('');

  isExternal = computed(() => {
    const href = this.href();
    const isAbsolute = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');

    if (!isAbsolute) return false;

    try {
      const parsed = new URL(href.startsWith('//') ? `https:${href}` : href);
      const internalHosts = [this.document.location.host, ...this.config.internalHosts];
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
        getPrimaryDomain(this.document.location.host),
        ...this.config.internalHosts.map(getPrimaryDomain),
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
