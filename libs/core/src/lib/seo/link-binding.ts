import { DOCUMENT } from '@angular/common';
import { computed, inject, isSignal, signal, untracked } from '@angular/core';
import { MaybeSignal } from '../signals';
import { createRootProvider, createStaticRootProvider } from '../utils';
import { applyHeadBinding, createArrayPropertyBinding, createPropertyBinding } from './head-binding';

export type LinkConfig = {
  rel: string;
  href: string;
  hreflang?: string;
  type?: string;
  sizes?: string;
  media?: string;
  as?: string;
  crossorigin?: string;
  integrity?: string;
  referrerpolicy?: string;

  /** Unique identifier for the link */
  key?: string;

  /** Whether multiple instances of this link are allowed */
  allowMultiple?: boolean;
};

type LinkBinding = {
  config: LinkConfig;
  element: HTMLLinkElement;
  priority: number;
};

export type LinkStoreConfig = {
  /**
   * Link rels that are allowed to have multiple instances
   * If you want to override the default set, extend your set from {@link DEFAULT_MULTI_INSTANCE_RELS}.
   * Otherwise, common multiple instance links may be removed unintentionally.
   * @example
   * ```ts
   * import { DEFAULT_MULTI_INSTANCE_RELS, provideLinkStoreConfig } from '@ethlete/core';
   *
   * provideLinkStoreConfig({
   *   multiInstanceRels: new Set([
   *     ...DEFAULT_MULTI_INSTANCE_RELS,
   *     'custom-rel',
   *   ]),
   * });
   * ```
   */
  multiInstanceRels: Set<string>;
};

export const DEFAULT_MULTI_INSTANCE_RELS = new Set([
  'alternate',
  'icon',
  'apple-touch-icon',
  'apple-touch-icon-precomposed',
  'preconnect',
  'dns-prefetch',
  'preload',
  'prefetch',
  'prerender',
  'stylesheet',
  'modulepreload',
]);

export const [provideLinkStoreConfig, injectLinkStoreConfig] = createStaticRootProvider<LinkStoreConfig>(
  {
    multiInstanceRels: DEFAULT_MULTI_INSTANCE_RELS,
  },
  { name: 'Link Store Config' },
);

export const [provideLinkStore, injectLinkStore] = createRootProvider(
  () => {
    const document = inject(DOCUMENT);
    const config = injectLinkStoreConfig();
    const linksByKey = signal<Map<string, Map<symbol, LinkBinding>>>(new Map());
    let priorityCounter = 0;

    const getLinkKey = (linkConfig: LinkConfig): string => {
      const isMultiInstance = config.multiInstanceRels.has(linkConfig.rel) || linkConfig.allowMultiple;

      if (isMultiInstance) {
        const keyParts = [linkConfig.rel];

        if (linkConfig.hreflang) keyParts.push(`hreflang:${linkConfig.hreflang}`);
        if (linkConfig.media) keyParts.push(`media:${linkConfig.media}`);
        if (linkConfig.sizes) keyParts.push(`sizes:${linkConfig.sizes}`);
        if (linkConfig.type) keyParts.push(`type:${linkConfig.type}`);
        if (linkConfig.as) keyParts.push(`as:${linkConfig.as}`);

        // For resource hints, include href to make them unique per origin/resource
        if (['preconnect', 'dns-prefetch', 'preload', 'prefetch', 'modulepreload'].includes(linkConfig.rel)) {
          keyParts.push(`href:${linkConfig.href}`);
        }

        return keyParts.join('|');
      }

      return linkConfig.rel;
    };

    const isMultiInstanceLink = (key: string): boolean => {
      const rel = key.split('|')[0];

      if (!rel) return false;

      return config.multiInstanceRels.has(rel);
    };

    const createLinkElement = (linkConfig: LinkConfig): HTMLLinkElement => {
      const link = document.createElement('link');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { key, allowMultiple, ...attributes } = linkConfig;

      Object.entries(attributes).forEach(([attrKey, value]) => {
        if (value !== undefined && value !== null) {
          link.setAttribute(attrKey, String(value));
        }
      });

      return link;
    };

    const applyActiveLinks = (key: string) => {
      const bindings = untracked(() => linksByKey().get(key));

      document.head.querySelectorAll(`link[data-link-key="${key}"]`).forEach((el) => el.remove());

      if (!bindings || bindings.size === 0) {
        return;
      }

      const allowMultiple =
        isMultiInstanceLink(key) || Array.from(bindings.values()).some((b) => b.config.allowMultiple);

      if (allowMultiple) {
        const sortedBindings = Array.from(bindings.values()).sort((a, b) => a.priority - b.priority);

        sortedBindings.forEach((binding) => {
          binding.element.setAttribute('data-link-key', key);
          document.head.appendChild(binding.element);
        });
      } else {
        const activeBinding = Array.from(bindings.values()).reduce((highest, current) =>
          current.priority > highest.priority ? current : highest,
        );

        activeBinding.element.setAttribute('data-link-key', key);
        document.head.appendChild(activeBinding.element);
      }
    };

    const addLink = (id: symbol, linkConfig: LinkConfig) => {
      const key = getLinkKey(linkConfig);
      const priority = priorityCounter++;
      const element = createLinkElement(linkConfig);

      linksByKey.update((linkMap) => {
        const newLinkMap = new Map(linkMap);
        const keyBindings = newLinkMap.get(key) || new Map();

        keyBindings.set(id, { config: linkConfig, element, priority });
        newLinkMap.set(key, new Map(keyBindings));

        return newLinkMap;
      });

      applyActiveLinks(key);
    };

    const removeLink = (id: symbol, key?: string) => {
      if (key) {
        linksByKey.update((linkMap) => {
          const newLinkMap = new Map(linkMap);
          const keyBindings = newLinkMap.get(key);

          if (keyBindings) {
            keyBindings.delete(id);

            if (keyBindings.size === 0) {
              newLinkMap.delete(key);
            } else {
              newLinkMap.set(key, new Map(keyBindings));
            }
          }

          return newLinkMap;
        });

        applyActiveLinks(key);
        return;
      }

      linksByKey.update((linkMap) => {
        const newLinkMap = new Map(linkMap);
        let affectedKey: string | undefined;

        for (const [k, bindings] of newLinkMap) {
          if (bindings.has(id)) {
            bindings.delete(id);
            affectedKey = k;

            if (bindings.size === 0) {
              newLinkMap.delete(k);
            } else {
              newLinkMap.set(k, new Map(bindings));
            }
            break;
          }
        }

        if (affectedKey) {
          queueMicrotask(() => applyActiveLinks(affectedKey));
        }

        return newLinkMap;
      });
    };

    return { addLink, removeLink, getLinkKey };
  },
  { name: 'Link Store' },
);

export const applyLinkBinding = (binding: MaybeSignal<LinkConfig | null | undefined>) => {
  const linkStore = injectLinkStore();
  const linkId = Symbol('link-tag');
  let currentKey: string | undefined;

  applyHeadBinding(
    binding,
    (config) => {
      currentKey = linkStore.getLinkKey(config);
      linkStore.addLink(linkId, config);
    },
    () => linkStore.removeLink(linkId, currentKey),
  );
};

export const applyCanonicalBinding = createPropertyBinding((href) => ({ rel: 'canonical', href }), applyLinkBinding);

export const applyAlternateBinding = (hreflang: string, binding: MaybeSignal<string | null | undefined>) => {
  applyLinkBinding(
    computed(() => {
      const url = untracked(() => (isSignal(binding) ? binding() : binding));
      return url ? { rel: 'alternate', hreflang, href: url } : null;
    }),
  );
};

export type AlternateLanguagesConfig = {
  [hreflang: string]: MaybeSignal<string | null | undefined>;
};

export const applyAlternateLanguagesBindings = (config: AlternateLanguagesConfig) => {
  Object.entries(config).forEach(([hreflang, binding]) => {
    applyAlternateBinding(hreflang, binding);
  });
};

export const applyPrevBinding = createPropertyBinding((href) => ({ rel: 'prev', href }), applyLinkBinding);

export const applyNextBinding = createPropertyBinding((href) => ({ rel: 'next', href }), applyLinkBinding);

export type ResourceHintsConfig = {
  preconnect?: MaybeSignal<string[] | null | undefined>;
  dnsPrefetch?: MaybeSignal<string[] | null | undefined>;
  prefetch?: MaybeSignal<string[] | null | undefined>;
  prerender?: MaybeSignal<string[] | null | undefined>;
};

export const applyResourceHintsBindings = (config: ResourceHintsConfig) => {
  if (config.preconnect) {
    createArrayPropertyBinding(
      (href, index) => ({ rel: 'preconnect', href, key: `preconnect:${index}` }),
      applyLinkBinding,
    )(config.preconnect);
  }

  if (config.dnsPrefetch) {
    createArrayPropertyBinding(
      (href, index) => ({ rel: 'dns-prefetch', href, key: `dns-prefetch:${index}` }),
      applyLinkBinding,
    )(config.dnsPrefetch);
  }

  if (config.prefetch) {
    createArrayPropertyBinding(
      (href, index) => ({ rel: 'prefetch', href, key: `prefetch:${index}` }),
      applyLinkBinding,
    )(config.prefetch);
  }

  if (config.prerender) {
    createArrayPropertyBinding(
      (href, index) => ({ rel: 'prerender', href, key: `prerender:${index}` }),
      applyLinkBinding,
    )(config.prerender);
  }
};
