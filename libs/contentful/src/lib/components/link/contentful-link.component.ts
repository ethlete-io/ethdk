import { DOCUMENT } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectContentfulConfig } from '../../utils/contentful-config';

const parseWebUrl = (href: string): URL | null => {
  if (!/^(?:https?:)?\/\//i.test(href)) {
    return null;
  }

  try {
    return new URL(href.startsWith('//') ? 'https:' + href : href);
  } catch {
    return null;
  }
};

const normalizeHostname = (host: string) => {
  const value = host.trim().toLowerCase();

  try {
    return new URL(value.includes('://') ? value : 'https://' + value).hostname;
  } catch {
    return value.split(':')[0] ?? value;
  }
};

const matchesHostname = (hostname: string, configuredHost: string) => {
  const normalizedHost = normalizeHostname(configuredHost);

  return hostname === normalizedHost || hostname.endsWith('.' + normalizedHost);
};

@Component({
  selector: 'et-contentful-link',
  template: `
    @if (usesRouterLink()) {
      <a [class]="linkClass()" [routerLink]="internalUrlTree()">{{ text() }}</a>
    } @else {
      <a
        [class]="linkClass()"
        [href]="href()"
        [target]="openInNewTab() ? '_blank' : null"
        [rel]="openInNewTab() ? 'noopener noreferrer' : null"
        >{{ text() }}</a
      >
    }
  `,
  styleUrl: './contentful-link.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
  host: {
    class: 'et-contentful-link',
  },
})
export class ContentfulLinkComponent {
  private document = inject(DOCUMENT);
  private router = inject(Router);
  private config = injectContentfulConfig();

  href = input.required<string>();
  text = input.required<string>();
  textClass = input('');

  protected usesRouterLink = computed(() => {
    const href = this.href();
    const absoluteUrl = parseWebUrl(href);

    if (absoluteUrl) {
      const internalHosts = [this.document.location.hostname, ...this.config.internalHosts];

      return internalHosts.some((host) => matchesHostname(absoluteUrl.hostname, host));
    }

    return !href.startsWith('#') && !/^[a-z][a-z\d+.-]*:/i.test(href);
  });

  protected openInNewTab = computed(() => Boolean(parseWebUrl(this.href())) && !this.usesRouterLink());

  protected internalPath = computed(() => {
    const href = this.href();
    const url = parseWebUrl(href);

    if (!url) {
      return href;
    }

    return url.pathname + url.search + url.hash;
  });

  protected internalUrlTree = computed(() => this.router.parseUrl(this.internalPath()));

  protected linkClass = computed(() => {
    const base = 'et-contentful-rich-text-default-element et-contentful-rich-text-default-a';
    const extra = this.textClass();

    return extra ? `${base} ${extra}` : base;
  });
}
