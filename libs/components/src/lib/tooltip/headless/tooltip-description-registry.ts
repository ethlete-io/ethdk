import { DOCUMENT, inject } from '@angular/core';
import { defineRootProvider, injectRenderer, toInjectFn } from '@ethlete/core';
import { createIdFactory } from '../../internals/id-factory';

const createTooltipDescriptionId = /* @__PURE__ */ createIdFactory('et-tooltip-description');

type TooltipDescriptionEntry = { element: HTMLElement; users: number };

const TOOLTIP_DESCRIPTION_REGISTRY_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();
    const entries = new Map<string, TooltipDescriptionEntry>();
    let container: HTMLElement | null = null;

    const ensureContainer = () => {
      if (container) return container;

      const element: HTMLElement = renderer.createElement('div');

      renderer.addClass(element, 'et-tooltip-descriptions');
      renderer.setStyle(element, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(1px, 1px, 1px, 1px)',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap',
        border: '0',
      });
      renderer.appendChild(document.body, element);
      container = element;

      return element;
    };

    const acquire = (text: string) => {
      const existing = entries.get(text);

      if (existing) {
        existing.users++;

        return existing.element.id;
      }

      const element: HTMLElement = renderer.createElement('div');

      renderer.setAttribute(element, 'id', createTooltipDescriptionId());
      renderer.setTextContent(element, text);
      renderer.appendChild(ensureContainer(), element);
      entries.set(text, { element, users: 1 });

      return element.id;
    };

    const release = (text: string) => {
      const entry = entries.get(text);

      if (!entry) return;

      entry.users--;

      if (entry.users > 0) return;

      entries.delete(text);
      entry.element.remove();

      if (!entries.size && container) {
        container.remove();
        container = null;
      }
    };

    return { acquire, release };
  },
  { name: 'TooltipDescriptionRegistry' },
);

export const injectTooltipDescriptionRegistry = /* @__PURE__ */ toInjectFn(TOOLTIP_DESCRIPTION_REGISTRY_DEF);
