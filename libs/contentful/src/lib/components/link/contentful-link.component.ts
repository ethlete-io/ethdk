import { DOCUMENT, Location } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectUrl } from '@ethlete/core';
import { injectContentfulConfig } from '../../utils/contentful-config';
import { hasUrlScheme, isInternalWebUrl, parseWebUrl, resolveHrefAgainstRoute } from './contentful-link.util';

const RICH_TEXT_ANCHOR_CLASSES = ['et-contentful-rich-text-default-element', 'et-contentful-rich-text-default-a'];

@Component({
  selector: 'et-contentful-link',
  template: `
    @if (usesRouterLink()) {
      <a [class]="modifierClasses()" [routerLink]="internalUrlTree()" class="et-contentful-link-anchor">{{ text() }}</a>
    } @else {
      <a
        [class]="modifierClasses()"
        [href]="anchorHref()"
        [attr.target]="openInNewTab() ? '_blank' : null"
        [attr.rel]="openInNewTab() ? 'noopener noreferrer' : null"
        class="et-contentful-link-anchor"
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
  marks = input<readonly string[]>([]);
  richText = input(false);

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

  protected modifierClasses = computed(() => [
    ...(this.richText() ? RICH_TEXT_ANCHOR_CLASSES : []),
    ...this.marks().map((mark) => `et-contentful-rich-text-mark-${mark}`),
  ]);
}
