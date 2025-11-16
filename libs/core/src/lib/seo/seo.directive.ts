import { Directive, inject, OnDestroy, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Observable, Subject, takeUntil } from 'rxjs';
import { SEO_DIRECTIVE_TOKEN } from './seo.directive.constants';
import { AlternateLink, SeoConfig } from './seo.directive.types';
import { mergeSeoConfig } from './seo.directive.utils';

@Directive({
  providers: [{ provide: SEO_DIRECTIVE_TOKEN, useExisting: SeoDirective }],
})
export class SeoDirective implements OnInit, OnDestroy {
  private readonly _metaService = inject(Meta);
  private readonly _titleService = inject(Title);
  private readonly _onDeactivate$ = new Subject<boolean>();

  private _isDeactivated = false;

  readonly parent = inject(SEO_DIRECTIVE_TOKEN, { optional: true, skipSelf: true });

  get config(): SeoConfig {
    return this._config;
  }
  private _config: SeoConfig = {};

  ngOnInit(): void {
    this.parent?._deactivate();
  }

  ngOnDestroy(): void {
    this._deactivate();
    this._cleanUp();
    this.parent?._activate();
  }

  // TODO(TRB): This should get split up into multiple methods to make it more readable
  // - updateTitle
  // - updateMeta
  // - updateLink
  updateConfig(config: SeoConfig) {
    this._config = mergeSeoConfig(config, this.parent?.config || {});

    if (this._isDeactivated) {
      return;
    }

    this._deactivate();
    this._activate();
  }

  _activate() {
    this._onDeactivate$.next(false);
    this._isDeactivated = false;

    for (const [key, value] of Object.entries(this._config)) {
      if (value instanceof Observable) {
        value.pipe(takeUntil(this._onDeactivate$)).subscribe((value) => this._update(key, value));
      } else if (Array.isArray(value)) {
        value.forEach((value) => {
          if (value instanceof Observable) {
            value.pipe(takeUntil(this._onDeactivate$)).subscribe((value) => this._update(key, value));
          } else {
            this._update(key, value);
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (subValue instanceof Observable) {
            subValue.pipe(takeUntil(this._onDeactivate$)).subscribe((value) => this._update(`${key}:${subKey}`, value));
          } else {
            this._update(`${key}:${subKey}`, subValue);
          }
        }
      } else {
        this._update(key, value);
      }
    }
  }

  _deactivate() {
    this._onDeactivate$.next(true);
    this._isDeactivated = true;
  }

  private _update(key: string, value: unknown) {
    switch (key) {
      case 'title':
        if (value && typeof value === 'string') {
          this._titleService.setTitle(value);
        }
        break;

      case 'canonical':
        {
          const link = document.querySelector(`link[rel="${key}"]`);

          if (link) {
            link.setAttribute('href', value as string);
          } else {
            const newLink = document.createElement('link');
            newLink.setAttribute('rel', key);
            newLink.setAttribute('href', value as string);
            document.head.appendChild(newLink);
          }
        }

        break;

      case 'alternate':
        {
          const link = document.querySelector(`link[rel="${key}"][hreflang="${(value as AlternateLink).hreflang}"]`);

          if (link) {
            link.setAttribute('href', (value as AlternateLink).href);
          } else {
            const newLink = document.createElement('link');
            newLink.setAttribute('rel', key);
            newLink.setAttribute('hreflang', (value as AlternateLink).hreflang);
            newLink.setAttribute('href', (value as AlternateLink).href);
            document.head.appendChild(newLink);
          }
        }

        break;

      default:
        if (value !== undefined && value !== null) {
          const val = Array.isArray(value) ? value.join(', ') : (value as string);

          this._metaService.updateTag({ name: key, content: val });
        } else {
          this._metaService.removeTag(`name="${key}"`);
        }
        break;
    }
  }

  private _cleanUp() {
    for (const key in this._config) {
      if (key === 'alternate') {
        const links = document.querySelectorAll(`link[rel="${key}"]`);

        links.forEach((link) => {
          link.remove();
        });

        continue;
      }

      if (key === 'canonical') {
        const link = document.querySelector(`link[rel="${key}"]`);

        if (link) {
          link.remove();
        }

        continue;
      }

      if (
        typeof this._config[key] === 'object' &&
        this._config[key] !== null &&
        !(this._config[key] instanceof Observable)
      ) {
        for (const subKey in this._config[key] as Record<string, unknown>) {
          const parentValue =
            this.parent?.config?.[key as keyof SeoConfig]?.[subKey as keyof SeoConfig[keyof SeoConfig]];

          if (parentValue === undefined) {
            this._update(`${key}:${subKey}`, undefined);
          }
        }
      } else {
        const parentValue = this.parent?.config?.[key as keyof SeoConfig];

        if (parentValue === undefined) {
          this._update(key, null);
        }
      }
    }
  }
}
