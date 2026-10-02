import { DOCUMENT, Location } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectUrl } from '@ethlete/core';
import { injectContentfulConfig } from '../../utils/contentful-config';
import { hasUrlScheme, isInternalWebUrl, parseWebUrl, resolveHrefAgainstRoute } from './contentful-link.util';

@Component({
  selector: 'et-contentful-link',
  template: `
    @if (usesRouterLink()) {
      <a [class]="linkClass()" [routerLink]="internalUrlTree()">{{ text() }}</a>
    } @else {
      <a
        [class]="linkClass()"
        [href]="anchorHref()"
        [attr.target]="openInNewTab() ? '_blank' : null"
        [attr.rel]="openInNewTab() ? 'noopener noreferrer' : null"
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
  private location = inject(Location);
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

    return !href.startsWith('#') && !hasUrlScheme(href);
  });

  protected anchorHref = computed(() => {
    const href = this.href();

    return href.startsWith('#') ? this.location.prepareExternalUrl(resolveHrefAgainstRoute(href, this.url())) : href;
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

    return resolveHrefAgainstRoute(href, this.url());
  });

  protected internalUrlTree = computed(() => this.router.parseUrl(this.internalPath()));

  protected linkClass = computed(() => [this.anchorClass(), this.textClass()].filter(Boolean).join(' ') || null);
}
