import { DOCUMENT } from '@angular/common';
import { inject, Injectable, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { PaginationHeadServiceConfig } from '../types';

@Injectable()
export class PaginationHeadService implements OnDestroy {
  private _config: PaginationHeadServiceConfig | null = null;
  private _document = inject(DOCUMENT);
  private _titleService = inject(Title);
  private _router = inject(Router);
  private _head = this._document.getElementsByTagName('head')[0];

  private get config(): PaginationHeadServiceConfig {
    return this._config ?? { titleTemplate: null, firstPageTitle: null, addCanonicalTag: false };
  }

  set addCanonicalTag(v: boolean) {
    this._config = { ...this.config, addCanonicalTag: v };
  }

  set titleTemplate(v: string | null) {
    this._config = { ...this.config, titleTemplate: v };
  }

  set firstPageTitle(v: string | null) {
    this._config = { ...this.config, firstPageTitle: v };
  }

  ngOnDestroy(): void {
    const element = this._getCanonicalElement(false);

    if (element) {
      this._removeCanonicalElement(element);
    }
  }

  _updateHead(page: number) {
    const { titleTemplate, addCanonicalTag, firstPageTitle } = this.config;

    if (titleTemplate && !titleTemplate.includes('%s')) {
      throw new Error('Title template must contain "%s" placeholder');
    }

    const title =
      page === 1 && firstPageTitle
        ? firstPageTitle
        : titleTemplate
          ? titleTemplate.replace('%s', page.toString())
          : null;

    if (title) {
      this._titleService.setTitle(title);
    }

    if (addCanonicalTag) {
      const urlTree = this._router.createUrlTree([], {
        queryParams: { page: null },
        queryParamsHandling: 'merge',
      });

      const relativeUrl = this._router.serializeUrl(urlTree);
      const canonicalUrl = `${window.location.origin}${relativeUrl}`;

      const element = this._getCanonicalElement(true);
      element.setAttribute('rel', 'canonical');
      element.setAttribute('href', canonicalUrl);
      this._head?.appendChild(element);
    }
  }

  private _getCanonicalElement<T extends boolean, R extends T extends true ? HTMLElement : HTMLElement | null>(
    createIfNotExisting: T,
  ) {
    let element = this._document.querySelector(`link[rel='canonical']`) || null;
    if (element === null && createIfNotExisting) {
      element = this._document.createElement('link') as HTMLLinkElement;
    }
    return element as R;
  }

  private _removeCanonicalElement(element: Element) {
    this._head?.removeChild(element);
  }
}
