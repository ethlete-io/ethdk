import { DOCUMENT } from '@angular/common';
import { inject, signal } from '@angular/core';
import { injectRenderer } from '../providers';
import { MaybeSignal } from '../signals';
import { defineRootProvider, defineStaticRootProvider, toInjectFn, toProvideFn } from '../utils';
import { applyHeadBinding } from './head-binding';
import * as JsonLD from './json-ld';

export type StructuredDataConfig = {
  /**
   * Where to place the JSON-LD script tag.
   * - 'head': Traditional placement, loaded before body content
   * - 'body': Google recommended, better for performance
   *
   * Note: You can also use the `StructuredDataComponent` to place structured data
   * directly within your component templates.
   *
   * @default 'body'
   */
  placement: 'head' | 'body';
};

const STRUCTURED_DATA_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<StructuredDataConfig>(
  {
    placement: 'body',
  },
  { name: 'Structured Data Config' },
);

export const provideStructuredDataConfig = /* @__PURE__ */ toProvideFn(STRUCTURED_DATA_CONFIG_DEF);
export const injectStructuredDataConfig = /* @__PURE__ */ toInjectFn(STRUCTURED_DATA_CONFIG_DEF);

const STRUCTURED_DATA_STORE_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();
    const config = injectStructuredDataConfig();
    const scripts = signal<Map<symbol, HTMLScriptElement>>(new Map());

    const getTargetElement = (): HTMLElement => {
      return config.placement === 'head' ? document.head : document.body;
    };

    const addStructuredData = (id: symbol, data: JsonLD.WithContext<JsonLD.Thing> | JsonLD.Graph) => {
      scripts.update((scriptMap) => {
        const newScripts = new Map(scriptMap);

        const oldScript = newScripts.get(id);
        if (oldScript && oldScript.parentNode) {
          renderer.removeChild(oldScript.parentNode, oldScript);
        }

        const script = renderer.createElement('script');

        renderer.setAttributes(script, { type: 'application/ld+json' });
        // The JSON is the script's *content*, not an attribute. Written as text rather than markup so a
        // `</script>` inside a string can't close the tag early — the escaping problem
        // `StructuredDataComponent` has to solve by hand because it goes through `innerHTML`.
        renderer.setTextContent(script, JSON.stringify(data));

        const target = getTargetElement();
        renderer.appendChild(target, script);

        newScripts.set(id, script);
        return newScripts;
      });
    };

    const removeStructuredData = (id: symbol) => {
      scripts.update((scriptMap) => {
        const newScripts = new Map(scriptMap);
        const script = newScripts.get(id);

        if (script && script.parentNode) {
          renderer.removeChild(script.parentNode, script);

          newScripts.delete(id);
        }

        return newScripts;
      });
    };

    return { addStructuredData, removeStructuredData };
  },
  { name: 'Structured Data Store' },
);

export const provideStructuredDataStore = /* @__PURE__ */ toProvideFn(STRUCTURED_DATA_STORE_DEF);
export const injectStructuredDataStore = /* @__PURE__ */ toInjectFn(STRUCTURED_DATA_STORE_DEF);

export const applyStructuredDataBinding = (
  binding: MaybeSignal<JsonLD.WithContext<JsonLD.Thing> | JsonLD.Graph | null | undefined>,
) => {
  const store = injectStructuredDataStore();
  const scriptId = Symbol('structured-data');

  applyHeadBinding(
    binding,
    (data) => store.addStructuredData(scriptId, data),
    () => store.removeStructuredData(scriptId),
  );
};
