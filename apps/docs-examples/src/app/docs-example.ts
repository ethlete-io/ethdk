import { PlatformLocation } from '@angular/common';
import { Type, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { defineRootProvider } from '@ethlete/core';
import { EXAMPLES } from '../examples';

const DOCS_EXAMPLE = defineRootProvider(() => {
  const location = inject(PlatformLocation);
  const router = inject(Router);
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const component = signal<Type<unknown> | null>(null);

  const load = () => {
    const loader = id ? EXAMPLES[id] : undefined;

    if (!loader) return Promise.resolve();

    return loader().then((example) => {
      const loaded = 'routes' in example ? example : { component: example, routes: [] };

      router.resetConfig(loaded.routes);
      component.set(loaded.component);
    });
  };

  return { id, theme: params.get('theme'), component: component.asReadonly(), load };
});

export const injectDocsExample = DOCS_EXAMPLE.inject;
