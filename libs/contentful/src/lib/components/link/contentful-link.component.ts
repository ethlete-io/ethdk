import { DOCUMENT } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectUrl } from '@ethlete/core';
import { injectContentfulConfig } from '../../utils/contentful-config';
import { isInternalWebUrl, parseWebUrl } from './contentful-link.util';

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
  private url = injectUrl();

  href = input.required<string>();
  text = input.required<string>();
  textClass = input('');
  anchorClass = input('');

  protected usesRouterLink = computed(() => {
    const href = this.href();
    const absoluteUrl = parseWebUrl(href);

    if (absoluteUrl) {
      return isInternalWebUrl(absoluteUrl, {
        location: this.document.location,
        internalHosts: this.config.internalHosts,
      });
    }

    return !href.startsWith('#') && !/^[a-z][a-z\d+.-]*:/i.test(href);
  });

  protected openInNewTab = computed(() => Boolean(parseWebUrl(this.href())) && !this.usesRouterLink());

  protected internalPath = computed(() => {
    const href = this.href();
    const url = parseWebUrl(href);

    if (url) {
      return url.pathname + url.search + url.hash;
    }

    if (href.startsWith('/')) {
      return href;
    }

    const resolved = new URL(href, 'https://contentful.invalid' + this.url());

    return resolved.pathname + resolved.search + resolved.hash;
  });

  protected internalUrlTree = computed(() => this.router.parseUrl(this.internalPath()));

  protected linkClass = computed(() => [this.anchorClass(), this.textClass()].filter(Boolean).join(' ') || null);
}
